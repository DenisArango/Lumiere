import type { Order, PaymentProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "@/utils/app-error";
import { generateTicketCode } from "@/utils/ticket-code";
import { releaseSeatLockKey } from "@/lib/seat-lock";
import { emitSeatEvent } from "@/lib/socket-server";
import { paymentGateways } from "@/modules/payments/payment-gateway.registry";
import { logger } from "@/lib/logger";

/**
 * Confirma el pago de una orden PENDING. Ver secuencia completa en
 * docs/05-diagramas-uml.md seccion 3 - esta funcion implementa exactamente
 * esa secuencia: cobra con el gateway correspondiente, y solo si el cobro
 * es exitoso marca la orden PAID, las butacas SOLD, libera los locks de
 * Redis y notifica por socket. Si el cobro falla, la orden permanece
 * PENDING (las butacas siguen bloqueadas hasta que el lock expire o el
 * cliente reintente/cancele) - nunca se vende una butaca sin cobro confirmado.
 */
export async function payOrder(
  orderId: string,
  userId: string,
  provider: PaymentProvider,
  source: string,
): Promise<Order> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { seats: true },
  });

  if (!order) {
    throw new NotFoundError("Orden");
  }
  if (order.userId !== userId) {
    throw new ForbiddenError();
  }
  if (order.status !== "PENDING") {
    throw new ConflictError("Esta orden no está pendiente de pago");
  }

  const gateway = paymentGateways[provider];
  let chargeResult;
  try {
    chargeResult = await gateway.charge({
      amount: Number(order.totalAmount),
      currency: "USD",
      source,
    });
  } catch (err) {
    // El SDK del proveedor lanza (no devuelve un status) ante clave
    // invalida, timeout de red, etc. - se trata igual que un cobro
    // rechazado (402), nunca se deja escapar como un 500 crudo que
    // filtraria el error interno del proveedor al cliente.
    logger.error({ orderId, provider, err }, "Error del proveedor de pago al cobrar");
    await prisma.payment.upsert({
      where: { orderId },
      create: { orderId, provider, providerPaymentId: `error_${Date.now()}`, amount: order.totalAmount, status: "FAILED" },
      update: { provider, status: "FAILED" },
    });
    throw new AppError(
      "No pudimos comunicarnos con el proveedor de pago. Tus butacas siguen reservadas, intenta de nuevo.",
      402,
    );
  }

  if (chargeResult.status !== "COMPLETED") {
    // upsert, no create: Payment.orderId es unico (un registro de pago por
    // orden). Un reintento tras un cobro rechazado actualiza ese registro
    // en vez de violar la constraint - el historial completo de intentos
    // fallidos queda como deuda tecnica (ver docs/backend/09-pagos.md).
    await prisma.payment.upsert({
      where: { orderId },
      create: {
        orderId,
        provider,
        providerPaymentId: chargeResult.providerPaymentId,
        amount: order.totalAmount,
        status: "FAILED",
      },
      update: { provider, providerPaymentId: chargeResult.providerPaymentId, status: "FAILED" },
    });
    logger.warn({ orderId, provider }, "Pago rechazado por el proveedor");
    throw new AppError(
      "El pago no pudo procesarse. Tus butacas siguen reservadas por un momento, intenta de nuevo.",
      402,
    );
  }

  const seatIds = order.seats.map((s) => s.showtimeSeatId);
  const qrCode = generateTicketCode();

  const updatedOrder = await prisma.$transaction(async (tx) => {
    await tx.payment.upsert({
      where: { orderId },
      create: {
        orderId,
        provider,
        providerPaymentId: chargeResult.providerPaymentId,
        amount: order.totalAmount,
        status: "COMPLETED",
      },
      update: { provider, providerPaymentId: chargeResult.providerPaymentId, status: "COMPLETED" },
    });

    await tx.showtimeSeat.updateMany({
      where: { id: { in: seatIds } },
      data: { status: "SOLD", lockedByUserId: null, lockExpiresAt: null },
    });

    return tx.order.update({
      where: { id: orderId },
      data: { status: "PAID", qrCode },
      include: { seats: true, items: true, payment: true },
    });
  });

  await Promise.all(seatIds.map((id) => releaseSeatLockKey(id)));
  emitSeatEvent(order.showtimeId, "seat:sold", { seatIds });

  logger.info({ orderId, provider }, "Pago confirmado");
  return updatedOrder;
}

/**
 * Reembolsa una orden PAID. Libera las butacas de vuelta a AVAILABLE -
 * decision de negocio: si el cliente cancela y se le reembolsa, la butaca
 * vuelve a estar disponible para otra persona en vez de quedar "vendida"
 * sin comprador real (ver docs/backend/09-pagos.md).
 */
export async function refundOrder(orderId: string, userId: string, isStaff: boolean): Promise<Order> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true, seats: true },
  });

  if (!order) {
    throw new NotFoundError("Orden");
  }
  if (order.userId !== userId && !isStaff) {
    throw new ForbiddenError();
  }
  if (order.status !== "PAID" || !order.payment) {
    throw new ConflictError("Solo se pueden reembolsar órdenes pagadas");
  }

  const gateway = paymentGateways[order.payment.provider];
  let refundResult;
  try {
    refundResult = await gateway.refund(order.payment.providerPaymentId, Number(order.payment.amount));
  } catch (err) {
    logger.error({ orderId, err }, "Error del proveedor de pago al reembolsar");
    throw new AppError("No pudimos comunicarnos con el proveedor de pago para el reembolso", 502);
  }

  if (refundResult.status !== "COMPLETED") {
    throw new AppError("El reembolso no pudo procesarse con el proveedor de pago", 502);
  }

  const seatIds = order.seats.map((s) => s.showtimeSeatId);

  const updatedOrder = await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { orderId }, data: { status: "REFUNDED" } });
    await tx.showtimeSeat.updateMany({
      where: { id: { in: seatIds } },
      data: { status: "AVAILABLE", lockedByUserId: null, lockExpiresAt: null },
    });
    return tx.order.update({ where: { id: orderId }, data: { status: "REFUNDED" } });
  });

  emitSeatEvent(order.showtimeId, "seat:released", { seatIds, reason: "refund" });

  logger.info({ orderId }, "Orden reembolsada");
  return updatedOrder;
}
