import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { AppError } from "@/utils/app-error";
import { recordAudit } from "@/modules/audit/audit.service";
import { finalizePaidOrder, finalizeRefund, refundAtProvider } from "@/modules/payments/payment.service";
import { toProviderAmount } from "@/modules/payments/currency";

/**
 * Webhooks de Stripe. Para que sirven: el sistema solo se entera de lo que el mismo pide. Estos eventos
 * cubren lo que pasa por fuera - un pago que termina despues (3D Secure abandonado y completado luego),
 * un reembolso hecho desde el panel de Stripe, un pago rechazado de forma asincrona.
 *
 * Cada manejador es idempotente (Stripe reintenta y a veces repite eventos), y los eventos ya procesados se
 * registran en webhook_events para ignorar duplicados.
 */

// constructEvent solo verifica la firma localmente; no llama a la API, asi que no necesita una clave real.
const verifier = new Stripe("sk_test_signature_verification_only");

export function constructStripeEvent(rawBody: Buffer, signature: string | undefined): Stripe.Event {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new AppError("Los webhooks de Stripe no están configurados (falta STRIPE_WEBHOOK_SECRET)", 503);
  }
  if (!signature) {
    throw new AppError("Falta la firma del webhook", 400);
  }
  try {
    return verifier.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    // Mensaje generico a proposito: no se le dice a un atacante por que fallo la verificacion.
    throw new AppError("Firma de webhook inválida", 400);
  }
}

async function onPaymentSucceeded(intent: Stripe.PaymentIntent): Promise<string> {
  const orderId = intent.metadata?.orderId;
  if (!orderId) return "ignored_no_order";

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return "ignored_unknown_order";

  if (order.status === "PAID") return "already_paid";

  if (order.status === "PENDING") {
    // No se confia ciegamente en el evento: debe ser el monto y la moneda de la orden.
    const expected = toProviderAmount("STRIPE", Number(order.totalAmount));
    const sameAmount = intent.amount === Math.round(expected.value * 100);
    const sameCurrency = intent.currency === expected.currency.toLowerCase();
    if (!sameAmount || !sameCurrency) {
      logger.error({ orderId, intent: intent.id }, "Webhook de Stripe con monto distinto al de la orden; no se marca pagada");
      await recordAudit({ action: "webhook.amount_mismatch", entityType: "Order", entityId: orderId, metadata: { intent: intent.id } });
      return "amount_mismatch";
    }
    const { changed } = await finalizePaidOrder(orderId, "STRIPE", intent.id);
    if (changed) {
      await recordAudit({ action: "webhook.order_paid", entityType: "Order", entityId: orderId, metadata: { intent: intent.id } });
    }
    return changed ? "order_paid" : "already_paid";
  }

  if (order.status === "CANCELLED" || order.status === "EXPIRED") {
    // Cobro huerfano: el cliente termino de pagar despues de que la orden se cancelo o expiro (y sus butacas
    // ya se liberaron). No se le puede dar el boleto, asi que se le devuelve el dinero automaticamente.
    await refundAtProvider("STRIPE", intent.id, Number(order.totalAmount));
    await recordAudit({
      action: "webhook.orphan_payment_refunded",
      entityType: "Order",
      entityId: orderId,
      metadata: { intent: intent.id, orderStatus: order.status },
    });
    return "orphan_refunded";
  }

  return "ignored";
}

async function onPaymentFailed(intent: Stripe.PaymentIntent): Promise<string> {
  const result = await prisma.payment.updateMany({
    where: { providerPaymentId: intent.id, status: "PENDING" },
    data: { status: "FAILED" },
  });
  return result.count > 0 ? "payment_failed" : "ignored";
}

async function onChargeRefunded(charge: Stripe.Charge): Promise<string> {
  const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!intentId) return "ignored_no_intent";

  // Solo reembolsos totales: la tienda reembolsa ordenes completas, no parcialmente.
  if (charge.amount_refunded < charge.amount) return "ignored_partial_refund";

  const payment = await prisma.payment.findFirst({ where: { providerPaymentId: intentId } });
  if (!payment) return "ignored_unknown_payment";

  const order = await prisma.order.findUnique({ where: { id: payment.orderId } });
  if (!order || order.status !== "PAID") return "already_refunded_or_not_paid";

  const { changed } = await finalizeRefund(order.id);
  if (changed) {
    await recordAudit({ action: "webhook.order_refunded", entityType: "Order", entityId: order.id, metadata: { intent: intentId } });
  }
  return changed ? "order_refunded" : "already_refunded_or_not_paid";
}

export async function handleStripeEvent(event: Stripe.Event): Promise<string> {
  const already = await prisma.webhookEvent.findUnique({ where: { id: event.id } });
  if (already) return "duplicate";

  let outcome: string;
  switch (event.type) {
    case "payment_intent.succeeded":
      outcome = await onPaymentSucceeded(event.data.object);
      break;
    case "payment_intent.payment_failed":
      outcome = await onPaymentFailed(event.data.object);
      break;
    case "charge.refunded":
      outcome = await onChargeRefunded(event.data.object);
      break;
    default:
      outcome = "ignored_event_type";
  }

  try {
    await prisma.webhookEvent.create({ data: { id: event.id, provider: "STRIPE", type: event.type } });
  } catch (err) {
    // Otra entrega del mismo evento llego a la vez: es un duplicado, no un error.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
  }

  logger.info({ eventId: event.id, type: event.type, outcome }, "Webhook de Stripe procesado");
  return outcome;
}
