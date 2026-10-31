import Stripe from "stripe";
import request from "supertest";
import { createApp } from "@/app";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { paymentGateways } from "@/modules/payments/payment-gateway.registry";
import { paypalWebhookVerifier } from "@/modules/webhooks/paypal-webhook.service";
import {
  createShowtimeFixture,
  createTestUser,
  loginAs,
  withAuth,
  ScriptedGateway,
  type Cookies,
  type ShowtimeFixture,
} from "@/test-utils/fixtures";

const app = createApp();
const suffix = `hooks${Date.now()}`;
const SECRET = "whsec_test_secret_for_lumiere";
const signer = new Stripe("sk_test_signing_only");
const stripeGw = new ScriptedGateway("pi");
const paypalGw = new ScriptedGateway("cap");
const mutableEnv = env as unknown as Record<string, unknown>;

const email = `test.hooks.buyer.${suffix}@lumiere.test`;
let fx: ShowtimeFixture;
let buyer: Cookies;
let seatCursor = 0;
let eventCounter = 0;

function evt(): string {
  eventCounter += 1;
  return `evt_${suffix}_${eventCounter}`;
}

/** Orden PENDING de 100 (butaca nueva cada vez). */
async function pendingOrder(): Promise<string> {
  const seatId = fx.seatIds[seatCursor] as string;
  seatCursor += 1;
  const lock = await withAuth(request(app).post(`/api/v1/showtimes/${fx.showtimeId}/seats/lock`), buyer).send({ seatIds: [seatId] });
  expect(lock.status).toBe(200);
  const order = await withAuth(request(app).post("/api/v1/orders"), buyer).send({ showtimeId: fx.showtimeId, seatIds: [seatId] });
  expect(order.status).toBe(201);
  return order.body.order.id as string;
}

function stripeEvent(type: string, object: Record<string, unknown>, id = evt()) {
  return { id, object: "event", type, data: { object } };
}

function postStripe(event: unknown, opts: { signature?: string | null; secret?: string } = {}) {
  const payload = JSON.stringify(event);
  const header =
    opts.signature === undefined
      ? signer.webhooks.generateTestHeaderString({ payload, secret: opts.secret ?? SECRET })
      : opts.signature;
  const req = request(app).post("/api/v1/webhooks/stripe").set("Content-Type", "application/json");
  if (header !== null) req.set("Stripe-Signature", header);
  return req.send(payload);
}

function intentObject(orderId: string, id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    object: "payment_intent",
    amount: 20000, // 100 GTQ convertidos a MXN al tipo de cambio de la prueba
    currency: "mxn",
    metadata: { orderId },
    ...overrides,
  };
}

const orderStatus = async (id: string) => (await prisma.order.findUniqueOrThrow({ where: { id } })).status;

beforeAll(async () => {
  paymentGateways.STRIPE = stripeGw;
  paymentGateways.PAYPAL = paypalGw;
  mutableEnv.STRIPE_WEBHOOK_SECRET = SECRET;
  mutableEnv.PAYPAL_WEBHOOK_ID = "WH-TEST";
  mutableEnv.PAYPAL_CURRENCY = "USD";
  mutableEnv.PAYPAL_RATE = 10; // 100 de la tienda = 10.00 USD
  mutableEnv.STRIPE_CURRENCY = "MXN";
  mutableEnv.STRIPE_RATE = 0.5; // 100 de la tienda = 200.00 MXN = 20000 centavos

  await createTestUser(email);
  buyer = await loginAs(app, email);
  fx = await createShowtimeFixture(suffix, 12, 100);
});

afterAll(async () => {
  await prisma.webhookEvent.deleteMany({ where: { id: { startsWith: `evt_${suffix}` } } });
  await prisma.auditLog.deleteMany({ where: { entityType: "Order", metadata: { path: ["intent"], string_contains: suffix } } }).catch(() => undefined);
  await fx.cleanup();
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
  await redis.quit().catch(() => undefined);
});

describe("Webhook de Stripe: autenticidad", () => {
  it("sin STRIPE_WEBHOOK_SECRET responde 503", async () => {
    const saved = mutableEnv.STRIPE_WEBHOOK_SECRET;
    mutableEnv.STRIPE_WEBHOOK_SECRET = undefined;
    const res = await postStripe(stripeEvent("payment_intent.succeeded", {}));
    mutableEnv.STRIPE_WEBHOOK_SECRET = saved;
    expect(res.status).toBe(503);
  });

  it("firma inválida, ajena o ausente: 400 y no cambia nada", async () => {
    const orderId = await pendingOrder();
    const event = stripeEvent("payment_intent.succeeded", intentObject(orderId, `pi_${suffix}_forged`));

    expect((await postStripe(event, { secret: "whsec_otro" })).status).toBe(400);
    expect((await postStripe(event, { signature: "t=1,v1=deadbeef" })).status).toBe(400);
    expect((await postStripe(event, { signature: null })).status).toBe(400);
    expect(await orderStatus(orderId)).toBe("PENDING");
  });
});

describe("Webhook de Stripe: eventos", () => {
  it("payment_intent.succeeded paga la orden; repetirlo no duplica nada", async () => {
    const orderId = await pendingOrder();
    const event = stripeEvent("payment_intent.succeeded", intentObject(orderId, `pi_${suffix}_ok`));

    const first = await postStripe(event);
    expect(first.status).toBe(200);
    expect(first.body.outcome).toBe("order_paid");

    const stored = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payment: true } });
    expect(stored.status).toBe("PAID");
    expect(stored.qrCode).toMatch(/^LMR-/);
    expect(stored.payment?.providerPaymentId).toBe(`pi_${suffix}_ok`);
    const seat = await prisma.showtimeSeat.findFirstOrThrow({ where: { orderSeat: { orderId } } });
    expect(seat.status).toBe("SOLD");

    const replay = await postStripe(event);
    expect(replay.body.outcome).toBe("duplicate");

    const newEventSameOrder = await postStripe(stripeEvent("payment_intent.succeeded", intentObject(orderId, `pi_${suffix}_ok`)));
    expect(newEventSameOrder.body.outcome).toBe("already_paid");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).qrCode).toBe(stored.qrCode);
  });

  it("si el monto del evento no coincide con la orden, NO se marca pagada", async () => {
    const orderId = await pendingOrder();
    const res = await postStripe(stripeEvent("payment_intent.succeeded", intentObject(orderId, `pi_${suffix}_cheap`, { amount: 100 })));
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe("amount_mismatch");
    expect(await orderStatus(orderId)).toBe("PENDING");
  });

  it("charge.refunded (reembolso hecho desde el panel de Stripe) deja la orden REFUNDED y libera la butaca", async () => {
    const orderId = await pendingOrder();
    const paid = await withAuth(request(app).post(`/api/v1/orders/${orderId}/pay`), buyer).send({ provider: "STRIPE", source: "pm_x" });
    expect(paid.status).toBe(200);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId } });

    const charge = { id: "ch_1", object: "charge", payment_intent: payment.providerPaymentId, amount: 10000, amount_refunded: 10000 };
    const res = await postStripe(stripeEvent("charge.refunded", charge));
    expect(res.body.outcome).toBe("order_refunded");
    expect(await orderStatus(orderId)).toBe("REFUNDED");
    const seat = await prisma.showtimeSeat.findFirstOrThrow({ where: { id: { in: fx.seatIds }, status: "AVAILABLE" } });
    expect(seat).toBeTruthy();

    const again = await postStripe(stripeEvent("charge.refunded", charge));
    expect(again.body.outcome).toBe("already_refunded_or_not_paid");
  });

  it("un reembolso parcial no cambia la orden", async () => {
    const orderId = await pendingOrder();
    await withAuth(request(app).post(`/api/v1/orders/${orderId}/pay`), buyer).send({ provider: "STRIPE", source: "pm_x" });
    const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId } });

    const res = await postStripe(
      stripeEvent("charge.refunded", { id: "ch_2", object: "charge", payment_intent: payment.providerPaymentId, amount: 10000, amount_refunded: 2500 }),
    );
    expect(res.body.outcome).toBe("ignored_partial_refund");
    expect(await orderStatus(orderId)).toBe("PAID");
  });

  it("un cobro que termina DESPUÉS de cancelarse la orden se reembolsa solo (no hay boleto que darle)", async () => {
    const orderId = await pendingOrder();
    const cancel = await withAuth(request(app).post(`/api/v1/orders/${orderId}/cancel`), buyer);
    expect(cancel.status).toBe(200);

    const before = stripeGw.refundCalls.length;
    const res = await postStripe(stripeEvent("payment_intent.succeeded", intentObject(orderId, `pi_${suffix}_late`)));
    expect(res.body.outcome).toBe("orphan_refunded");
    expect(stripeGw.refundCalls.length).toBe(before + 1);
    expect(stripeGw.refundCalls.at(-1)).toMatchObject({ providerPaymentId: `pi_${suffix}_late`, amount: 100 });
    expect(await orderStatus(orderId)).toBe("CANCELLED");
  });

  it("payment_intent.payment_failed marca el pago pendiente como FAILED", async () => {
    const orderId = await pendingOrder();
    await prisma.payment.create({
      data: { orderId, provider: "STRIPE", providerPaymentId: `pi_${suffix}_fail`, amount: 100, status: "PENDING" },
    });
    const res = await postStripe(stripeEvent("payment_intent.payment_failed", intentObject(orderId, `pi_${suffix}_fail`)));
    expect(res.body.outcome).toBe("payment_failed");
    expect((await prisma.payment.findUniqueOrThrow({ where: { orderId } })).status).toBe("FAILED");
  });

  it("un tipo de evento que no manejamos se acepta (200) sin tocar nada", async () => {
    const res = await postStripe(stripeEvent("customer.created", { id: "cus_1" }));
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe("ignored_event_type");
  });
});

describe("Webhook de PayPal", () => {
  const originalVerify = paypalWebhookVerifier.verify;
  let verifies = true;

  beforeAll(() => {
    paypalWebhookVerifier.verify = async () => verifies;
  });
  afterAll(() => {
    paypalWebhookVerifier.verify = originalVerify;
  });

  function postPayPal(event: unknown) {
    return request(app)
      .post("/api/v1/webhooks/paypal")
      .set("Content-Type", "application/json")
      .set("paypal-transmission-id", "tid")
      .send(JSON.stringify(event));
  }

  const completed = (orderId: string, captureId: string, value = "10.00") => ({
    id: evt(),
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource: { id: captureId, custom_id: orderId, amount: { value, currency_code: "USD" } },
  });

  it("sin PAYPAL_WEBHOOK_ID responde 503", async () => {
    const saved = mutableEnv.PAYPAL_WEBHOOK_ID;
    mutableEnv.PAYPAL_WEBHOOK_ID = undefined;
    const res = await postPayPal(completed("x", "y"));
    mutableEnv.PAYPAL_WEBHOOK_ID = saved;
    expect(res.status).toBe(503);
  });

  it("si PayPal no valida la firma: 400 y no cambia nada", async () => {
    const orderId = await pendingOrder();
    verifies = false;
    const res = await postPayPal(completed(orderId, `CAP_${suffix}_forged`));
    verifies = true;
    expect(res.status).toBe(400);
    expect(await orderStatus(orderId)).toBe("PENDING");
  });

  it("PAYMENT.CAPTURE.COMPLETED paga la orden (monto convertido a la moneda de PayPal) y se guarda el id de la CAPTURA", async () => {
    const orderId = await pendingOrder();
    const res = await postPayPal(completed(orderId, `CAP_${suffix}_ok`));
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe("order_paid");

    const stored = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payment: true } });
    expect(stored.status).toBe("PAID");
    expect(stored.payment).toMatchObject({ provider: "PAYPAL", providerPaymentId: `CAP_${suffix}_ok` });
  });

  it("un monto distinto al de la orden no la marca pagada", async () => {
    const orderId = await pendingOrder();
    const res = await postPayPal(completed(orderId, `CAP_${suffix}_low`, "0.01"));
    expect(res.body.outcome).toBe("amount_mismatch");
    expect(await orderStatus(orderId)).toBe("PENDING");
  });

  it("PAYMENT.CAPTURE.REFUNDED (reembolso desde PayPal) deja la orden REFUNDED", async () => {
    const orderId = await pendingOrder();
    const captureId = `CAP_${suffix}_refund`;
    await postPayPal(completed(orderId, captureId));

    const res = await postPayPal({
      id: evt(),
      event_type: "PAYMENT.CAPTURE.REFUNDED",
      resource: {
        id: "REFUND_1",
        links: [
          { rel: "self", href: "https://api.paypal.com/v2/payments/refunds/REFUND_1" },
          { rel: "up", href: `https://api.paypal.com/v2/payments/captures/${captureId}` },
        ],
      },
    });
    expect(res.body.outcome).toBe("order_refunded");
    expect(await orderStatus(orderId)).toBe("REFUNDED");
  });
});
