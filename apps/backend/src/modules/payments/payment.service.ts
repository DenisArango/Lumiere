import type { Order, PaymentProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "@/utils/app-error";
import { generateTicketCode } from "@/utils/ticket-code";
import { releaseSeatLockKey } from "@/lib/seat-lock";
import { emitSeatEvent } from "@/lib/socket-server";
import { paymentGateways } from "@/modules/payments/payment-gateway.registry";
import type { CheckoutSession } from "@/modules/payments/payment-gateway";
import { logger } from "@/lib/logger";
import { pointsForAmount } from "@/modules/users/loyalty";

/** Accion que el navegador debe completar antes de que el cobro termine (3D Secure). */
export interface PendingAction {
  type: "stripe_3ds";
  clientSecret: string;
  paymentIntentId: string;
}

export interface PayResult {
  order: Order;
  action?: PendingAction;
}

/**
 * Marca una orden PENDING como PAID. Es el UNICO lugar donde una orden pasa a pagada: lo usan el pago
 * directo, la confirmacion tras 3D Secure y los webhooks, asi las tres rutas se comportan igual.
 *
 * Es idempotente y segura ante carreras: la orden se "reclama" con un UPDATE condicionado a que siga
 * PENDING; si un webhook y la peticion del cliente llegan a la vez, solo uno gana y el otro no repite
 * nada (ni dobles puntos ni doble QR).
 */
export async function finalizePaidOrder(
  orderId: string,
  provider: PaymentProvider,
  providerPaymentId: string,
): Promise<{ order: Order; changed: boolean }> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { seats: true } });
  if (!order) {
    throw new NotFoundError("Orden");
  }
  if (order.status === "PAID") {
    return { order, changed: false };
  }
  if (order.status !== "PENDING") {
    throw new ConflictError("Esta orden ya no está pendiente de pago");
  }

  const seatIds = order.seats.map((s) => s.showtimeSeatId);

  const updated = await prisma.$transaction(async (tx) => {
    const claim = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: "PAID", qrCode: generateTicketCode() },
    });
    if (claim.count === 0) return null;

    await tx.payment.upsert({
      where: { orderId },
      create: { orderId, provider, providerPaymentId, amount: order.totalAmount, status: "COMPLETED" },
      update: { provider, providerPaymentId, status: "COMPLETED" },
    });

    await tx.showtimeSeat.updateMany({
      where: { id: { in: seatIds } },
      data: { status: "SOLD", lockedByUserId: null, lockExpiresAt: null },
    });

    // Programa de puntos: solo suman los miembros; se guarda lo otorgado para que un reembolso revierta exactamente eso.
    const buyer = await tx.user.findUnique({ where: { id: order.userId }, select: { loyaltyMember: true } });
    const pointsEarned = buyer?.loyaltyMember ? pointsForAmount(Number(order.totalAmount)) : 0;
    if (pointsEarned > 0) {
      await tx.user.update({ where: { id: order.userId }, data: { loyaltyPoints: { increment: pointsEarned } } });
      await tx.order.update({ where: { id: orderId }, data: { pointsEarned } });
    }

    return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { seats: true, items: true, payment: true } });
  });

  if (!updated) {
    // Otro proceso (por ejemplo el webhook) la marco pagada un instante antes.
    return { order: await prisma.order.findUniqueOrThrow({ where: { id: orderId } }), changed: false };
  }

  await Promise.all(seatIds.map((id) => releaseSeatLockKey(id)));
  emitSeatEvent(order.showtimeId, "seat:sold", { seatIds });

  logger.info({ orderId, provider }, "Pago confirmado");
  return { order: updated, changed: true };
}

/**
 * Marca una orden PAID como REFUNDED y deja todo listo para venderse de nuevo: butacas libres, filas
 * order_seats sueltas, puntos ajustados. Idempotente (mismo "reclamo" atomico que finalizePaidOrder).
 * NO mueve dinero: lo usan tanto el reembolso iniciado aqui (despues de que el proveedor devolvio el
 * cobro) como los webhooks (cuando el reembolso se hizo desde el panel del proveedor).
 */
export async function finalizeRefund(orderId: string): Promise<{ order: Order; changed: boolean }> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { seats: true } });
  if (!order) {
    throw new NotFoundError("Orden");
  }
  if (order.status === "REFUNDED") {
    return { order, changed: false };
  }
  if (order.status !== "PAID") {
    throw new ConflictError("Solo se pueden reembolsar órdenes pagadas");
  }

  const seatIds = order.seats.map((s) => s.showtimeSeatId);

  const updated = await prisma.$transaction(async (tx) => {
    const claim = await tx.order.updateMany({ where: { id: orderId, status: "PAID" }, data: { status: "REFUNDED" } });
    if (claim.count === 0) return null;

    await tx.payment.updateMany({ where: { orderId }, data: { status: "REFUNDED" } });
    await tx.showtimeSeat.updateMany({
      where: { id: { in: seatIds } },
      data: { status: "AVAILABLE", lockedByUserId: null, lockExpiresAt: null },
    });
    // Sin esto la butaca liberada no se podria recomprar: order_seats.showtimeSeatId es unico.
    await tx.orderSeat.deleteMany({ where: { orderId } });

    // Puntos: se quitan los ganados con esta compra y se devuelven los que el cliente gasto en ella.
    if (order.pointsEarned > 0 || order.pointsRedeemed > 0) {
      const owner = await tx.user.findUnique({ where: { id: order.userId }, select: { loyaltyPoints: true } });
      const points = Math.max(0, (owner?.loyaltyPoints ?? 0) - order.pointsEarned) + order.pointsRedeemed;
      await tx.user.update({ where: { id: order.userId }, data: { loyaltyPoints: points } });
    }

    return tx.order.findUniqueOrThrow({ where: { id: orderId } });
  });

  if (!updated) {
    return { order: await prisma.order.findUniqueOrThrow({ where: { id: orderId } }), changed: false };
  }

  emitSeatEvent(order.showtimeId, "seat:released", { seatIds, reason: "refund" });
  logger.info({ orderId }, "Orden reembolsada");
  return { order: updated, changed: true };
}

async function loadOwnedPendingOrder(orderId: string, userId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { seats: true } });
  if (!order) {
    throw new NotFoundError("Orden");
  }
  if (order.userId !== userId) {
    throw new ForbiddenError();
  }
  if (order.status !== "PENDING") {
    throw new ConflictError("Esta orden no está pendiente de pago");
  }
  return order;
}

/**
 * Cobra una orden PENDING. Si el banco pide autenticacion (3D Secure) NO se marca pagada: se devuelve
 * la accion que el navegador debe completar y la orden sigue PENDING hasta confirmPayment (o el webhook).
 * Si el cobro falla, la orden permanece PENDING y las butacas siguen bloqueadas hasta que el lock
 * expire o el cliente reintente/cancele - nunca se vende una butaca sin cobro confirmado.
 */
export async function payOrder(
  orderId: string,
  userId: string,
  provider: PaymentProvider,
  source: string,
): Promise<PayResult> {
  const order = await loadOwnedPendingOrder(orderId, userId);

  const gateway = paymentGateways[provider];
  let chargeResult;
  try {
    chargeResult = await gateway.charge({
      amount: Number(order.totalAmount),
      currency: env.PAYMENT_CURRENCY,
      source,
      orderId,
    });
  } catch (err) {
    // El SDK del proveedor lanza (no devuelve un status) ante clave invalida, timeout de red, etc. - se
    // trata igual que un cobro rechazado (402), nunca se deja escapar como un 500 crudo que filtraria el
    // error interno del proveedor al cliente.
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

  if (chargeResult.status === "REQUIRES_ACTION" && chargeResult.clientSecret) {
    await prisma.payment.upsert({
      where: { orderId },
      create: { orderId, provider, providerPaymentId: chargeResult.providerPaymentId, amount: order.totalAmount, status: "PENDING" },
      update: { provider, providerPaymentId: chargeResult.providerPaymentId, status: "PENDING" },
    });
    return {
      order,
      action: { type: "stripe_3ds", clientSecret: chargeResult.clientSecret, paymentIntentId: chargeResult.providerPaymentId },
    };
  }

  if (chargeResult.status !== "COMPLETED") {
    // upsert, no create: Payment.orderId es unico (un registro de pago por orden). Un reintento tras un
    // cobro rechazado actualiza ese registro en vez de violar la constraint.
    await prisma.payment.upsert({
      where: { orderId },
      create: { orderId, provider, providerPaymentId: chargeResult.providerPaymentId, amount: order.totalAmount, status: "FAILED" },
      update: { provider, providerPaymentId: chargeResult.providerPaymentId, status: "FAILED" },
    });
    logger.warn({ orderId, provider }, "Pago rechazado por el proveedor");
    throw new AppError("El pago no pudo procesarse. Tus butacas siguen reservadas por un momento, intenta de nuevo.", 402);
  }

  const { order: paid } = await finalizePaidOrder(orderId, provider, chargeResult.providerPaymentId);
  return { order: paid };
}

/**
 * Cierra un pago que quedo esperando 3D Secure. El navegador avisa que termino, pero eso no se da por
 * cierto: el gateway vuelve a consultar al proveedor y verifica que sea de esta orden y por el monto exacto.
 */
export async function confirmPayment(orderId: string, userId: string, providerPaymentId: string): Promise<Order> {
  const order = await loadOwnedPendingOrder(orderId, userId);

  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (!payment || payment.providerPaymentId !== providerPaymentId) {
    throw new ConflictError("Este pago no corresponde a la orden");
  }

  const gateway = paymentGateways[payment.provider];
  if (!gateway.confirm) {
    throw new AppError("Este proveedor no usa confirmación posterior", 400);
  }

  let result;
  try {
    result = await gateway.confirm({
      providerPaymentId,
      orderId,
      amount: Number(order.totalAmount),
      currency: env.PAYMENT_CURRENCY,
    });
  } catch (err) {
    logger.error({ orderId, err }, "Error del proveedor al confirmar el pago");
    throw new AppError("No pudimos verificar el pago con el proveedor. Intenta de nuevo.", 402);
  }

  if (result.status !== "COMPLETED") {
    await prisma.payment.update({ where: { orderId }, data: { status: "FAILED" } });
    throw new AppError("La autenticación del pago no se completó. Tus butacas siguen reservadas, intenta de nuevo.", 402);
  }

  const { order: paid } = await finalizePaidOrder(orderId, payment.provider, providerPaymentId);
  return paid;
}

/** PayPal: crea la orden de PayPal en el servidor con el total de NUESTRA orden (el cliente no decide el monto). */
export async function createCheckoutSession(
  orderId: string,
  userId: string,
  provider: PaymentProvider,
): Promise<CheckoutSession> {
  const order = await loadOwnedPendingOrder(orderId, userId);

  const gateway = paymentGateways[provider];
  if (!gateway.createCheckoutSession) {
    throw new AppError("Este proveedor no usa sesión de pago previa", 400);
  }

  try {
    return await gateway.createCheckoutSession({
      orderId,
      amount: Number(order.totalAmount),
      currency: env.PAYMENT_CURRENCY,
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error({ orderId, provider, err }, "Error del proveedor al crear la sesión de pago");
    throw new AppError("No pudimos iniciar el pago con el proveedor. Intenta de nuevo.", 502);
  }
}

/** Devuelve el dinero en el proveedor. Separado de finalizeRefund porque los webhooks ya llegan con el dinero devuelto. */
export async function refundAtProvider(provider: PaymentProvider, providerPaymentId: string, amount: number): Promise<void> {
  let result;
  try {
    result = await paymentGateways[provider].refund(providerPaymentId, amount);
  } catch (err) {
    logger.error({ providerPaymentId, err }, "Error del proveedor de pago al reembolsar");
    throw new AppError("No pudimos comunicarnos con el proveedor de pago para el reembolso", 502);
  }
  if (result.status !== "COMPLETED") {
    throw new AppError("El reembolso no pudo procesarse con el proveedor de pago", 502);
  }
}

/**
 * Reembolsa una orden PAID. Libera las butacas de vuelta a AVAILABLE - decision de negocio: si el cliente
 * cancela y se le reembolsa, la butaca vuelve a estar disponible para otra persona en vez de quedar
 * "vendida" sin comprador real (ver docs/backend/09-pagos.md).
 */
export async function refundOrder(orderId: string, userId: string, isStaff: boolean): Promise<Order> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } });
  if (!order) {
    throw new NotFoundError("Orden");
  }
  if (order.userId !== userId && !isStaff) {
    throw new ForbiddenError();
  }
  return refundPaidOrder(order.id);
}

/** Reembolso sin comprobar quien lo pide (lo usan staff y la cancelacion de funciones). Valida que la orden este pagada. */
export async function refundPaidOrder(orderId: string): Promise<Order> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } });
  if (!order) {
    throw new NotFoundError("Orden");
  }
  if (order.status !== "PAID" || !order.payment) {
    throw new ConflictError("Solo se pueden reembolsar órdenes pagadas");
  }

  await refundAtProvider(order.payment.provider, order.payment.providerPaymentId, Number(order.payment.amount));
  const { order: refunded } = await finalizeRefund(orderId);
  return refunded;
}
