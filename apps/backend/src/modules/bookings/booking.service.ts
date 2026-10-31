import type { Order, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { acquireSeatLock, releaseSeatLockKey } from "@/lib/seat-lock";
import { emitSeatEvent } from "@/lib/socket-server";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/utils/app-error";
import { POINTS_PER_DISCOUNT_UNIT, redeemableDiscountUnits } from "@/modules/users/loyalty";
import { calculateDiscount, getApplicablePromotion } from "@/modules/promotions/promotion.service";
import { paginate, toSkipTake, type PaginatedResult } from "@/utils/pagination";
import type { CreateOrderInput } from "@/modules/bookings/booking.schema";
import type { Pagination } from "@/utils/pagination";

const TTL_SECONDS = env.SEAT_LOCK_TTL_SECONDS;

/**
 * Libera butacas cuyo bloqueo ya vencio (lockExpiresAt en el pasado) antes
 * de cualquier operacion de lectura/escritura sobre disponibilidad. La
 * llave de Redis correspondiente ya habra expirado sola por su propio TTL
 * (se fijo con el mismo valor) - aqui solo se sincroniza la fila de
 * Postgres, que es la fuente de verdad consultable.
 */
export async function sweepExpiredLocks(showtimeId: string): Promise<void> {
  const expired = await prisma.showtimeSeat.findMany({
    where: { showtimeId, status: "LOCKED", lockExpiresAt: { lt: new Date() } },
    select: { id: true },
  });

  if (expired.length === 0) return;

  const expiredIds = expired.map((s) => s.id);

  // OrderSeat.showtimeSeatId es unico: si la fila de una orden pendiente vencida se queda, esa
  // butaca no se puede volver a ordenar nunca (500). Se libera junto con la butaca, y la orden
  // huerfana pasa a EXPIRED.
  await prisma.$transaction(async (tx) => {
    const stale = await tx.orderSeat.findMany({
      where: { showtimeSeatId: { in: expiredIds }, order: { status: "PENDING" } },
      select: { orderId: true },
    });
    const staleOrders = await tx.order.findMany({
      where: { id: { in: [...new Set(stale.map((s) => s.orderId))] }, status: "PENDING", pointsRedeemed: { gt: 0 } },
      select: { userId: true, pointsRedeemed: true },
    });
    for (const o of staleOrders) {
      await tx.user.update({ where: { id: o.userId }, data: { loyaltyPoints: { increment: o.pointsRedeemed } } });
    }
    await tx.orderSeat.deleteMany({
      where: { showtimeSeatId: { in: expiredIds }, order: { status: "PENDING" } },
    });
    if (stale.length > 0) {
      await tx.order.updateMany({
        where: { id: { in: [...new Set(stale.map((s) => s.orderId))] }, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
    }
    await tx.showtimeSeat.updateMany({
      where: { id: { in: expiredIds } },
      data: { status: "AVAILABLE", lockedByUserId: null, lockExpiresAt: null },
    });
  });

  emitSeatEvent(showtimeId, "seat:released", { seatIds: expired.map((s) => s.id), reason: "expired" });
}

/**
 * Mapa de butacas de una funcion: combina el layout fisico de la sala
 * (fila, numero, tipo de butaca) con el estado especifico de ESA funcion
 * (AVAILABLE/LOCKED/SOLD) - ver docs/04-modelo-datos.md seccion 3 sobre por
 * que ShowtimeSeat es una entidad separada de Seat. Lectura publica: no
 * revela quien tiene bloqueada una butaca, solo que esta ocupada.
 */
export async function getSeatMap(showtimeId: string) {
  await sweepExpiredLocks(showtimeId);

  const showtime = await prisma.showtime.findUnique({ where: { id: showtimeId } });
  if (!showtime) {
    throw new NotFoundError("Función");
  }

  const showtimeSeats = await prisma.showtimeSeat.findMany({
    where: { showtimeId },
    include: { seat: { include: { seatType: true } } },
    orderBy: [{ seat: { rowLabel: "asc" } }, { seat: { seatNumber: "asc" } }],
  });

  return showtimeSeats.map((s) => ({
    id: s.id,
    rowLabel: s.seat.rowLabel,
    seatNumber: s.seat.seatNumber,
    seatType: s.seat.seatType,
    status: s.status,
  }));
}

export async function lockSeats(showtimeId: string, seatIds: string[], userId: string) {
  await sweepExpiredLocks(showtimeId);

  const showtime = await prisma.showtime.findUnique({ where: { id: showtimeId } });
  if (!showtime || showtime.status !== "SCHEDULED") {
    throw new NotFoundError("Función");
  }
  if (showtime.startTime <= new Date()) {
    throw new ConflictError("Esta función ya comenzó");
  }

  const seats = await prisma.showtimeSeat.findMany({
    where: { showtimeId, id: { in: seatIds } },
  });

  if (seats.length !== seatIds.length) {
    throw new NotFoundError("Una o más butacas");
  }

  const unavailable = seats.filter((s) => s.status !== "AVAILABLE");
  if (unavailable.length > 0) {
    throw new ConflictError("Una o más butacas ya no están disponibles", {
      seatIds: unavailable.map((s) => s.id),
    });
  }

  const acquired: string[] = [];
  for (const seat of seats) {
    // eslint-disable-next-line no-await-in-loop -- deben adquirirse en secuencia para poder revertir limpiamente si una falla
    const ok = await acquireSeatLock(seat.id, userId, TTL_SECONDS);
    if (!ok) {
      await Promise.all(acquired.map((id) => releaseSeatLockKey(id)));
      throw new ConflictError("Otra persona está reservando una de estas butacas en este momento", {
        seatId: seat.id,
      });
    }
    acquired.push(seat.id);
  }

  const lockExpiresAt = new Date(Date.now() + TTL_SECONDS * 1000);
  await prisma.showtimeSeat.updateMany({
    where: { id: { in: acquired } },
    data: { status: "LOCKED", lockedByUserId: userId, lockExpiresAt },
  });

  emitSeatEvent(showtimeId, "seat:locked", { seatIds: acquired, lockExpiresAt });

  return { seatIds: acquired, lockExpiresAt, ttlSeconds: TTL_SECONDS };
}

export async function releaseSeats(
  showtimeId: string,
  seatIds: string[],
  userId: string,
): Promise<string[]> {
  const seats = await prisma.showtimeSeat.findMany({
    where: { showtimeId, id: { in: seatIds }, status: "LOCKED", lockedByUserId: userId },
  });

  if (seats.length === 0) return [];

  await prisma.showtimeSeat.updateMany({
    where: { id: { in: seats.map((s) => s.id) } },
    data: { status: "AVAILABLE", lockedByUserId: null, lockExpiresAt: null },
  });

  await Promise.all(seats.map((s) => releaseSeatLockKey(s.id)));
  emitSeatEvent(showtimeId, "seat:released", { seatIds: seats.map((s) => s.id), reason: "manual" });

  return seats.map((s) => s.id);
}

export async function createOrder(userId: string, input: CreateOrderInput) {
  await sweepExpiredLocks(input.showtimeId);

  const showtime = await prisma.showtime.findUnique({ where: { id: input.showtimeId } });
  if (!showtime) {
    throw new NotFoundError("Función");
  }
  if (showtime.status !== "SCHEDULED") {
    throw new ConflictError("Esta función ya no está disponible");
  }
  if (showtime.startTime <= new Date()) {
    throw new ConflictError("Esta función ya comenzó");
  }

  const seats = await prisma.showtimeSeat.findMany({
    where: { showtimeId: input.showtimeId, id: { in: input.seatIds } },
    include: { seat: { include: { seatType: true } } },
  });

  if (seats.length !== input.seatIds.length) {
    throw new NotFoundError("Una o más butacas");
  }

  const notHeldByUser = seats.filter((s) => s.status !== "LOCKED" || s.lockedByUserId !== userId);
  if (notHeldByUser.length > 0) {
    throw new ConflictError(
      "Debes bloquear estas butacas antes de crear la orden (o el bloqueo expiró)",
      { seatIds: notHeldByUser.map((s) => s.id) },
    );
  }

  const seatsSubtotal = seats.reduce(
    (sum, s) => sum + Number(showtime.basePrice) * Number(s.seat.seatType.priceMultiplier),
    0,
  );

  let itemsSubtotal = 0;
  const orderItemsData: { productId: string; quantity: number; priceAtPurchase: number }[] = [];

  if (input.items && input.items.length > 0) {
    const products = await prisma.product.findMany({
      where: { id: { in: input.items.map((i) => i.productId) }, isActive: true },
    });
    if (products.length !== input.items.length) {
      throw new NotFoundError("Uno o más productos");
    }
    for (const item of input.items) {
      const product = products.find((p) => p.id === item.productId)!;
      itemsSubtotal += Number(product.price) * item.quantity;
      orderItemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        priceAtPurchase: Number(product.price),
      });
    }
  }

  const subtotal = seatsSubtotal + itemsSubtotal;

  let promotionId: string | undefined;
  let discountAmount = 0;
  if (input.promotionCode) {
    const promotion = await getApplicablePromotion(input.promotionCode, input.showtimeId);
    promotionId = promotion.id;
    discountAmount = calculateDiscount(promotion, subtotal);
  }

  // Canje de puntos: se valida contra el saldo real y se limita a la mitad de lo que queda por pagar.
  let pointsRedeemed = 0;
  if (input.redeemPoints && input.redeemPoints > 0) {
    const member = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { loyaltyMember: true, loyaltyPoints: true },
    });
    if (!member.loyaltyMember) {
      throw new ValidationError("Únete al programa de puntos para poder canjearlos");
    }
    if (input.redeemPoints % POINTS_PER_DISCOUNT_UNIT !== 0) {
      throw new ValidationError(`Los puntos se canjean en múltiplos de ${POINTS_PER_DISCOUNT_UNIT}`);
    }
    const maxUnits = redeemableDiscountUnits(member.loyaltyPoints, subtotal - discountAmount);
    if (input.redeemPoints / POINTS_PER_DISCOUNT_UNIT > maxUnits) {
      throw new ValidationError(`En esta compra puedes canjear hasta ${maxUnits * POINTS_PER_DISCOUNT_UNIT} puntos`);
    }
    pointsRedeemed = input.redeemPoints;
    discountAmount += pointsRedeemed / POINTS_PER_DISCOUNT_UNIT;
  }

  const order = await prisma.$transaction(async (tx) => {
    // Autocuracion de datos previos al arreglo: ordenes ya cancelladas/reembolsadas/expiradas pudieron
    // dejar su fila order_seats (unica por butaca) y bloquear para siempre la recompra de esa butaca.
    await tx.orderSeat.deleteMany({
      where: {
        showtimeSeatId: { in: seats.map((s) => s.id) },
        order: { status: { in: ["CANCELLED", "REFUNDED", "EXPIRED"] } },
      },
    });

    if (pointsRedeemed > 0) {
      // Condicionado al saldo: dos compras simultaneas no pueden gastar los mismos puntos.
      const spent = await tx.user.updateMany({
        where: { id: userId, loyaltyPoints: { gte: pointsRedeemed } },
        data: { loyaltyPoints: { decrement: pointsRedeemed } },
      });
      if (spent.count === 0) {
        throw new ConflictError("Ya no tienes puntos suficientes para este canje");
      }
    }

    const created = await tx.order.create({
      data: {
        userId,
        pointsRedeemed,
        showtimeId: input.showtimeId,
        status: "PENDING",
        subtotal,
        discountAmount,
        totalAmount: subtotal - discountAmount,
        promotionId,
        seats: {
          create: seats.map((s) => ({
            showtimeSeatId: s.id,
            priceAtPurchase: Number(showtime.basePrice) * Number(s.seat.seatType.priceMultiplier),
          })),
        },
        ...(orderItemsData.length > 0 ? { items: { create: orderItemsData } } : {}),
      },
      include: { seats: true, items: true },
    });

    return created;
  });

  return order;
}

export async function cancelOrder(orderId: string, userId: string, isStaff: boolean): Promise<Order> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { seats: true } });
  if (!order) {
    throw new NotFoundError("Orden");
  }
  if (order.userId !== userId && !isStaff) {
    throw new ForbiddenError();
  }
  if (order.status !== "PENDING") {
    throw new ConflictError("Solo se pueden cancelar órdenes pendientes de pago");
  }

  const showtimeSeatIds = order.seats.map((s) => s.showtimeSeatId);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.showtimeSeat.updateMany({
      where: { id: { in: showtimeSeatIds }, lockedByUserId: order.userId },
      data: { status: "AVAILABLE", lockedByUserId: null, lockExpiresAt: null },
    });
    // Soltar la fila order_seats: su showtimeSeatId es unico y, si se queda, la butaca no se puede volver a comprar.
    await tx.orderSeat.deleteMany({ where: { orderId } });
    if (order.pointsRedeemed > 0) {
      await tx.user.update({ where: { id: order.userId }, data: { loyaltyPoints: { increment: order.pointsRedeemed } } });
    }
    return tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
  });

  await Promise.all(showtimeSeatIds.map((id) => releaseSeatLockKey(id)));
  emitSeatEvent(order.showtimeId, "seat:released", { seatIds: showtimeSeatIds, reason: "order_cancelled" });

  return updated;
}

const orderDetailInclude = {
  showtime: {
    include: {
      movie: { select: { id: true, title: true, posterUrl: true } },
      room: { include: { cinema: { select: { id: true, name: true, city: true } } } },
    },
  },
  seats: { include: { showtimeSeat: { include: { seat: true } } } },
  items: { include: { product: true } },
  payment: true,
} as const;

export async function getOrderById(orderId: string, userId: string, isStaff: boolean) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: orderDetailInclude });
  if (!order) {
    throw new NotFoundError("Orden");
  }
  if (order.userId !== userId && !isStaff) {
    throw new ForbiddenError();
  }
  return order;
}

export async function listMyOrders(userId: string, query: Pagination): Promise<PaginatedResult<unknown>> {
  const where = { userId };
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        showtime: { include: { movie: { select: { id: true, title: true, posterUrl: true } } } },
      },
      orderBy: { createdAt: "desc" },
      ...toSkipTake(query),
    }),
    prisma.order.count({ where }),
  ]);
  return paginate(items, total, query);
}

/** Listado para el panel (staff): todas las ordenes, con comprador, pelicula y pago. */
export async function listAllOrders(
  query: Pagination & { status?: OrderStatus },
): Promise<PaginatedResult<unknown>> {
  const where = query.status ? { status: query.status } : {};
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        showtime: { include: { movie: { select: { id: true, title: true, posterUrl: true } } } },
        payment: { select: { provider: true, status: true } },
        seats: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      ...toSkipTake(query),
    }),
    prisma.order.count({ where }),
  ]);
  return paginate(items, total, query);
}
