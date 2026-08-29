import type { Order } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { acquireSeatLock, releaseSeatLockKey } from "@/lib/seat-lock";
import { emitSeatEvent } from "@/lib/socket-server";
import { ConflictError, ForbiddenError, NotFoundError } from "@/utils/app-error";
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

  await prisma.showtimeSeat.updateMany({
    where: { id: { in: expired.map((s) => s.id) } },
    data: { status: "AVAILABLE", lockedByUserId: null, lockExpiresAt: null },
  });

  emitSeatEvent(showtimeId, "seat:released", { seatIds: expired.map((s) => s.id), reason: "expired" });
}

export async function lockSeats(showtimeId: string, seatIds: string[], userId: string) {
  await sweepExpiredLocks(showtimeId);

  const showtime = await prisma.showtime.findUnique({ where: { id: showtimeId } });
  if (!showtime || showtime.status !== "SCHEDULED") {
    throw new NotFoundError("Función");
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

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId,
        showtimeId: input.showtimeId,
        status: "PENDING",
        subtotal,
        discountAmount: 0,
        totalAmount: subtotal,
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
