import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { paymentGateways } from "@/modules/payments/payment-gateway.registry";
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
const suffix = `flows${Date.now()}`;

const stripeGw = new ScriptedGateway("pi");
const paypalGw = new ScriptedGateway("cap");

const emails = {
  buyer: `test.flows.buyer.${suffix}@lumiere.test`,
  other: `test.flows.other.${suffix}@lumiere.test`,
  member: `test.flows.member.${suffix}@lumiere.test`,
  admin: `test.flows.admin.${suffix}@lumiere.test`,
};

let fx: ShowtimeFixture;
let cancelFx: ShowtimeFixture;
let buyer: Cookies;
let other: Cookies;
let member: Cookies;
let admin: Cookies;
let memberId: string;

async function lockSeat(c: Cookies, showtimeId: string, seatId: string) {
  const res = await withAuth(request(app).post(`/api/v1/showtimes/${showtimeId}/seats/lock`), c).send({ seatIds: [seatId] });
  expect(res.status).toBe(200);
}

function createOrder(c: Cookies, showtimeId: string, seatId: string, extra: Record<string, unknown> = {}) {
  return withAuth(request(app).post("/api/v1/orders"), c).send({ showtimeId, seatIds: [seatId], ...extra });
}

function pay(c: Cookies, orderId: string, provider: "STRIPE" | "PAYPAL" = "STRIPE") {
  return withAuth(request(app).post(`/api/v1/orders/${orderId}/pay`), c).send({ provider, source: "tok_test" });
}

async function points(userId: string): Promise<number> {
  return (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).loyaltyPoints;
}

beforeAll(async () => {
  paymentGateways.STRIPE = stripeGw;
  paymentGateways.PAYPAL = paypalGw;

  await createTestUser(emails.buyer);
  await createTestUser(emails.other);
  memberId = (await createTestUser(emails.member, "CUSTOMER", { loyaltyMember: true, loyaltyPoints: 500 })).id;
  await createTestUser(emails.admin, "SUPER_ADMIN");
  [buyer, other, member, admin] = await Promise.all([
    loginAs(app, emails.buyer),
    loginAs(app, emails.other),
    loginAs(app, emails.member),
    loginAs(app, emails.admin),
  ]);

  fx = await createShowtimeFixture(suffix, 8, 100);
  cancelFx = await createShowtimeFixture(`${suffix}c`, 4, 100);
});

afterAll(async () => {
  await fx.cleanup();
  await cancelFx.cleanup();
  await prisma.auditLog.deleteMany({ where: { user: { email: { in: Object.values(emails) } } } });
  await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
  await prisma.$disconnect();
  await redis.quit().catch(() => undefined);
});

describe("3D Secure", () => {
  let orderId: string;
  let intentId: string;

  it("si el banco pide autenticación, responde 202 con la acción y la orden sigue PENDING", async () => {
    stripeGw.chargeResult = { status: "REQUIRES_ACTION", clientSecret: "pi_secret_test" };
    await lockSeat(buyer, fx.showtimeId, fx.seatIds[0] as string);
    const order = await createOrder(buyer, fx.showtimeId, fx.seatIds[0] as string);
    orderId = order.body.order.id;

    const res = await pay(buyer, orderId);
    expect(res.status).toBe(202);
    expect(res.body.action).toMatchObject({ type: "stripe_3ds", clientSecret: "pi_secret_test" });
    intentId = res.body.action.paymentIntentId;

    const stored = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payment: true } });
    expect(stored.status).toBe("PENDING");
    expect(stored.payment?.status).toBe("PENDING");
    stripeGw.chargeResult = { status: "COMPLETED" };
  });

  it("confirmar con otro id de pago o por otra persona se rechaza", async () => {
    const wrongIntent = await withAuth(request(app).post(`/api/v1/orders/${orderId}/pay/confirm`), buyer).send({ paymentIntentId: "pi_otro" });
    expect(wrongIntent.status).toBe(409);

    const notOwner = await withAuth(request(app).post(`/api/v1/orders/${orderId}/pay/confirm`), other).send({ paymentIntentId: intentId });
    expect(notOwner.status).toBe(403);
  });

  it("si el proveedor dice que la autenticación no se completó: 402, la orden sigue PENDING y el pago queda FAILED", async () => {
    stripeGw.confirmStatus = "FAILED";
    const res = await withAuth(request(app).post(`/api/v1/orders/${orderId}/pay/confirm`), buyer).send({ paymentIntentId: intentId });
    expect(res.status).toBe(402);

    const stored = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payment: true } });
    expect(stored.status).toBe("PENDING");
    expect(stored.payment?.status).toBe("FAILED");
  });

  it("al completarse la autenticación la orden pasa a PAID con su QR", async () => {
    // El pago volvio a quedar esperando autenticacion (nuevo intento) y ahora el proveedor confirma.
    stripeGw.chargeResult = { status: "REQUIRES_ACTION", clientSecret: "pi_secret_retry" };
    const retry = await pay(buyer, orderId);
    expect(retry.status).toBe(202);
    stripeGw.chargeResult = { status: "COMPLETED" };
    stripeGw.confirmStatus = "COMPLETED";

    const res = await withAuth(request(app).post(`/api/v1/orders/${orderId}/pay/confirm`), buyer).send({
      paymentIntentId: retry.body.action.paymentIntentId,
    });
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("PAID");
    expect(res.body.order.qrCode).toMatch(/^LMR-/);

    const again = await withAuth(request(app).post(`/api/v1/orders/${orderId}/pay/confirm`), buyer).send({
      paymentIntentId: retry.body.action.paymentIntentId,
    });
    expect(again.status).toBe(409);
  });
});

describe("Sesión de pago de PayPal", () => {
  it("la orden de PayPal la crea el servidor con el total de la orden, no el cliente", async () => {
    await lockSeat(buyer, fx.showtimeId, fx.seatIds[1] as string);
    const order = await createOrder(buyer, fx.showtimeId, fx.seatIds[1] as string);
    const orderId = order.body.order.id as string;

    const res = await withAuth(request(app).post(`/api/v1/orders/${orderId}/checkout-session`), buyer).send({ provider: "PAYPAL" });
    expect(res.status).toBe(200);
    expect(res.body.session.providerOrderId).toContain(orderId.slice(0, 8));
    expect(res.body.session.chargedAmount).toBe(Number(order.body.order.totalAmount));

    const notOwner = await withAuth(request(app).post(`/api/v1/orders/${orderId}/checkout-session`), other).send({ provider: "PAYPAL" });
    expect(notOwner.status).toBe(403);
  });

  it("la configuración pública no expone secretos", async () => {
    const res = await request(app).get("/api/v1/payments/config");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("currency");
    expect(JSON.stringify(res.body)).not.toMatch(/secret|sk_/i);
  });
});

describe("Canje de puntos", () => {
  const seat = () => fx.seatIds[2] as string;

  it("valida: múltiplos de 10, tope del 50 % y solo para miembros", async () => {
    await lockSeat(member, fx.showtimeId, seat());

    const notMultiple = await createOrder(member, fx.showtimeId, seat(), { redeemPoints: 505 });
    expect(notMultiple.status).toBe(422);

    // Orden de 100: como maximo 50 unidades = 500 puntos. 510 se pasa.
    const tooMany = await createOrder(member, fx.showtimeId, seat(), { redeemPoints: 510 });
    expect(tooMany.status).toBe(422);

    // Quien no es miembro del programa no puede canjear.
    await lockSeat(buyer, fx.showtimeId, fx.seatIds[3] as string);
    const nonMember = await createOrder(buyer, fx.showtimeId, fx.seatIds[3] as string, { redeemPoints: 10 });
    expect(nonMember.status).toBe(422);
    await withAuth(request(app).post(`/api/v1/showtimes/${fx.showtimeId}/seats/release`), buyer).send({ seatIds: [fx.seatIds[3]] });
  });

  it("canjear 300 puntos descuenta 30, aparta los puntos y los devuelve al cancelar", async () => {
    const res = await createOrder(member, fx.showtimeId, seat(), { redeemPoints: 300 });
    expect(res.status).toBe(201);
    expect(Number(res.body.order.discountAmount)).toBe(30);
    expect(Number(res.body.order.totalAmount)).toBe(70);
    expect(res.body.order.pointsRedeemed).toBe(300);
    expect(await points(memberId)).toBe(200);

    const cancel = await withAuth(request(app).post(`/api/v1/orders/${res.body.order.id}/cancel`), member);
    expect(cancel.status).toBe(200);
    expect(await points(memberId)).toBe(500);
  });

  it("pagar suma puntos sobre lo realmente pagado y un reembolso restituye el saldo exacto", async () => {
    await lockSeat(member, fx.showtimeId, fx.seatIds[4] as string);
    const order = await createOrder(member, fx.showtimeId, fx.seatIds[4] as string, { redeemPoints: 300 });
    expect(order.status).toBe(201);
    expect(await points(memberId)).toBe(200);

    const paid = await pay(member, order.body.order.id);
    expect(paid.status).toBe(200);
    expect(paid.body.order.pointsEarned).toBe(70); // gano sobre 70, lo que pago, no sobre 100
    expect(await points(memberId)).toBe(270);

    const refund = await withAuth(request(app).post(`/api/v1/orders/${order.body.order.id}/refund`), member);
    expect(refund.status).toBe(200);
    expect(await points(memberId)).toBe(500); // -70 ganados, +300 devueltos
  });

  it("un bloqueo vencido con puntos canjeados los devuelve", async () => {
    const seatId = fx.seatIds[5] as string;
    await lockSeat(member, fx.showtimeId, seatId);
    const order = await createOrder(member, fx.showtimeId, seatId, { redeemPoints: 100 });
    expect(order.status).toBe(201);
    expect(await points(memberId)).toBe(400);

    await prisma.showtimeSeat.update({ where: { id: seatId }, data: { lockExpiresAt: new Date(Date.now() - 1000) } });
    await redis.del(`seatlock:${seatId}`);
    await request(app).get(`/api/v1/showtimes/${fx.showtimeId}/seats`);

    expect(await points(memberId)).toBe(500);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.body.order.id } })).status).toBe("EXPIRED");
  });
});

describe("Cancelar una función liquida sus órdenes", () => {
  it("reembolsa las pagadas, cancela las pendientes y reporta las que fallan sin detener al resto", async () => {
    const [s0, s1, s2] = cancelFx.seatIds as [string, string, string];

    await lockSeat(buyer, cancelFx.showtimeId, s0);
    const a = (await createOrder(buyer, cancelFx.showtimeId, s0)).body.order.id as string;
    await pay(buyer, a);

    await lockSeat(other, cancelFx.showtimeId, s1);
    const c = (await createOrder(other, cancelFx.showtimeId, s1)).body.order.id as string;
    await pay(other, c);
    const failingPayment = await prisma.payment.findUniqueOrThrow({ where: { orderId: c } });
    paypalGw.failRefundFor.add(failingPayment.providerPaymentId);
    stripeGw.failRefundFor.add(failingPayment.providerPaymentId);

    await lockSeat(member, cancelFx.showtimeId, s2);
    const b = (await createOrder(member, cancelFx.showtimeId, s2, { redeemPoints: 100 })).body.order.id as string;
    expect(await points(memberId)).toBe(400);

    const res = await withAuth(request(app).patch(`/api/v1/showtimes/${cancelFx.showtimeId}`), admin).send({ status: "CANCELLED" });
    expect(res.status).toBe(200);
    expect(res.body.cancellation.refunded).toBe(1);
    expect(res.body.cancellation.cancelledPending).toBe(1);
    expect(res.body.cancellation.failed).toHaveLength(1);
    expect(res.body.cancellation.failed[0].orderId).toBe(c);

    const status = async (id: string) => (await prisma.order.findUniqueOrThrow({ where: { id } })).status;
    expect(await status(a)).toBe("REFUNDED");
    expect(await status(b)).toBe("CANCELLED");
    expect(await status(c)).toBe("PAID"); // su reembolso fallo: queda para atencion manual
    expect(await points(memberId)).toBe(500); // el canje de la orden pendiente se devolvio

    const audit = await prisma.auditLog.findFirst({ where: { action: "showtime.cancel_settlement", entityId: cancelFx.showtimeId } });
    expect(audit).not.toBeNull();
  });

  it("una función cancelada ya no se puede bloquear ni comprar", async () => {
    const lock = await withAuth(request(app).post(`/api/v1/showtimes/${cancelFx.showtimeId}/seats/lock`), buyer).send({
      seatIds: [cancelFx.seatIds[3]],
    });
    expect(lock.status).toBe(404);
  });
});

describe("Funciones que ya comenzaron", () => {
  it("no se listan ni se pueden bloquear butacas", async () => {
    const past = await createShowtimeFixture(`${suffix}p`, 2, 100);
    try {
      const showtime = await prisma.showtime.findUniqueOrThrow({ where: { id: past.showtimeId } });
      const before = await request(app).get(`/api/v1/showtimes?movieId=${showtime.movieId}`);
      expect(before.body.items).toHaveLength(1);

      await prisma.showtime.update({ where: { id: past.showtimeId }, data: { startTime: new Date(Date.now() - 60 * 60 * 1000) } });

      const after = await request(app).get(`/api/v1/showtimes?movieId=${showtime.movieId}`);
      expect(after.body.items).toHaveLength(0);

      const lock = await withAuth(request(app).post(`/api/v1/showtimes/${past.showtimeId}/seats/lock`), buyer).send({
        seatIds: [past.seatIds[0]],
      });
      expect(lock.status).toBe(409);
    } finally {
      await past.cleanup();
    }
  });
});

