import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { AppError } from "@/utils/app-error";
import { recordAudit } from "@/modules/audit/audit.service";
import { finalizePaidOrder, finalizeRefund } from "@/modules/payments/payment.service";
import { toPayPalAmount } from "@/modules/payments/gateways/paypal-gateway";

/**
 * Webhooks de PayPal: mismo proposito que los de Stripe (pagos que terminan por fuera del flujo del sitio y
 * reembolsos hechos desde el panel de PayPal). PayPal no firma con un secreto compartido: la verificacion se
 * le delega a su propia API (verify-webhook-signature) usando el id del webhook registrado en su panel.
 */

export interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource: {
    id?: string;
    custom_id?: string;
    amount?: { value?: string; currency_code?: string };
    links?: { rel?: string; href?: string }[];
  };
}

function apiBase(): string {
  return env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

async function verifyWithPayPal(headers: Record<string, string | undefined>, rawBody: Buffer): Promise<boolean> {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET || !env.PAYPAL_WEBHOOK_ID) return false;

  const basic = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const tokenRes = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!tokenRes.ok) return false;
  const { access_token: accessToken } = (await tokenRes.json()) as { access_token?: string };
  if (!accessToken) return false;

  const res = await fetch(`${apiBase()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: headers["paypal-auth-algo"],
      cert_url: headers["paypal-cert-url"],
      transmission_id: headers["paypal-transmission-id"],
      transmission_sig: headers["paypal-transmission-sig"],
      transmission_time: headers["paypal-transmission-time"],
      webhook_id: env.PAYPAL_WEBHOOK_ID,
      webhook_event: JSON.parse(rawBody.toString("utf8")),
    }),
  });
  if (!res.ok) return false;
  const { verification_status: status } = (await res.json()) as { verification_status?: string };
  return status === "SUCCESS";
}

/** Objeto (no funcion suelta) para que las pruebas puedan sustituir la verificacion sin llamar a PayPal. */
export const paypalWebhookVerifier = { verify: verifyWithPayPal };

export async function constructPayPalEvent(
  rawBody: Buffer,
  headers: Record<string, string | undefined>,
): Promise<PayPalWebhookEvent> {
  if (!env.PAYPAL_WEBHOOK_ID) {
    throw new AppError("Los webhooks de PayPal no están configurados (falta PAYPAL_WEBHOOK_ID)", 503);
  }
  let valid = false;
  try {
    valid = await paypalWebhookVerifier.verify(headers, rawBody);
  } catch (err) {
    logger.error({ err }, "No se pudo verificar la firma del webhook de PayPal");
  }
  if (!valid) {
    throw new AppError("Firma de webhook inválida", 400);
  }
  try {
    return JSON.parse(rawBody.toString("utf8")) as PayPalWebhookEvent;
  } catch {
    throw new AppError("Cuerpo de webhook inválido", 400);
  }
}

async function onCaptureCompleted(event: PayPalWebhookEvent): Promise<string> {
  const captureId = event.resource.id;
  const orderId = event.resource.custom_id;
  if (!captureId || !orderId) return "ignored_no_order";

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return "ignored_unknown_order";
  if (order.status === "PAID") return "already_paid";
  if (order.status !== "PENDING") return "ignored";

  const expected = toPayPalAmount(Number(order.totalAmount));
  if (event.resource.amount?.value !== expected.value || event.resource.amount?.currency_code !== expected.currency) {
    logger.error({ orderId, captureId }, "Webhook de PayPal con monto distinto al de la orden; no se marca pagada");
    await recordAudit({ action: "webhook.amount_mismatch", entityType: "Order", entityId: orderId, metadata: { captureId } });
    return "amount_mismatch";
  }

  const { changed } = await finalizePaidOrder(orderId, "PAYPAL", captureId);
  if (changed) {
    await recordAudit({ action: "webhook.order_paid", entityType: "Order", entityId: orderId, metadata: { captureId } });
  }
  return changed ? "order_paid" : "already_paid";
}

async function onCaptureRefunded(event: PayPalWebhookEvent): Promise<string> {
  // El recurso es el REEMBOLSO; la captura original va en el enlace "up" (.../captures/{id}).
  const up = event.resource.links?.find((l) => l.rel === "up")?.href;
  const captureId = up?.split("/").pop();
  if (!captureId) return "ignored_no_capture";

  const payment = await prisma.payment.findFirst({ where: { providerPaymentId: captureId, provider: "PAYPAL" } });
  if (!payment) return "ignored_unknown_payment";

  const order = await prisma.order.findUnique({ where: { id: payment.orderId } });
  if (!order || order.status !== "PAID") return "already_refunded_or_not_paid";

  const { changed } = await finalizeRefund(order.id);
  if (changed) {
    await recordAudit({ action: "webhook.order_refunded", entityType: "Order", entityId: order.id, metadata: { captureId } });
  }
  return changed ? "order_refunded" : "already_refunded_or_not_paid";
}

async function onCaptureDenied(event: PayPalWebhookEvent): Promise<string> {
  const captureId = event.resource.id;
  if (!captureId) return "ignored";
  const result = await prisma.payment.updateMany({
    where: { providerPaymentId: captureId, provider: "PAYPAL", status: "PENDING" },
    data: { status: "FAILED" },
  });
  return result.count > 0 ? "payment_failed" : "ignored";
}

export async function handlePayPalEvent(event: PayPalWebhookEvent): Promise<string> {
  const already = await prisma.webhookEvent.findUnique({ where: { id: event.id } });
  if (already) return "duplicate";

  let outcome: string;
  switch (event.event_type) {
    case "PAYMENT.CAPTURE.COMPLETED":
      outcome = await onCaptureCompleted(event);
      break;
    case "PAYMENT.CAPTURE.REFUNDED":
      outcome = await onCaptureRefunded(event);
      break;
    case "PAYMENT.CAPTURE.DENIED":
    case "PAYMENT.CAPTURE.DECLINED":
      outcome = await onCaptureDenied(event);
      break;
    default:
      outcome = "ignored_event_type";
  }

  try {
    await prisma.webhookEvent.create({ data: { id: event.id, provider: "PAYPAL", type: event.event_type } });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
  }

  logger.info({ eventId: event.id, type: event.event_type, outcome }, "Webhook de PayPal procesado");
  return outcome;
}
