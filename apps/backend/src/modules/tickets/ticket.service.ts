import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/utils/app-error";
import { logger } from "@/lib/logger";

const ticketInclude = {
  user: { select: { firstName: true, lastName: true } },
  showtime: {
    include: {
      movie: { select: { title: true, posterUrl: true } },
      room: { select: { name: true, cinema: { select: { name: true } } } },
    },
  },
  seats: { include: { showtimeSeat: { include: { seat: true } } } },
} as const;

/**
 * Valida un boleto en la entrada de la sala (taquilla) - es el "reemplazo
 * de validacion manual" prometido en docs/01-requerimientos.md seccion
 * "Valor agregado" (codigo QR). Un mismo codigo solo puede canjearse una
 * vez: se revisa y se marca `checkedInAt` en la misma operacion para que
 * una captura de pantalla reenviada no vuelva a funcionar.
 */
export async function validateTicket(qrCode: string, staffUserId: string) {
  const order = await prisma.order.findUnique({ where: { qrCode }, include: ticketInclude });

  if (!order) {
    throw new NotFoundError("Boleto");
  }

  if (order.status !== "PAID") {
    throw new ConflictError("Esta orden no está pagada, el boleto no es válido");
  }

  if (order.checkedInAt) {
    throw new ConflictError(
      `Este boleto ya fue validado el ${order.checkedInAt.toLocaleString("es-MX")}`,
    );
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { checkedInAt: new Date() },
    include: ticketInclude,
  });

  logger.info({ orderId: order.id, staffUserId }, "Boleto validado en taquilla");

  return updated;
}
