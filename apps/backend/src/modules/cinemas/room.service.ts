import type { Room } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/utils/app-error";
import type { CreateRoomInput, UpdateRoomInput } from "@/modules/cinemas/room.schema";

export async function listRoomsByCinema(cinemaId: string) {
  const cinema = await prisma.cinema.findUnique({ where: { id: cinemaId } });
  if (!cinema) {
    throw new NotFoundError("Cine");
  }
  return prisma.room.findMany({ where: { cinemaId }, orderBy: { name: "asc" } });
}

export async function getRoomById(id: string) {
  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      cinema: { select: { id: true, name: true, city: true } },
      seats: {
        include: { seatType: true },
        orderBy: [{ rowLabel: "asc" }, { seatNumber: "asc" }],
      },
    },
  });

  if (!room) {
    throw new NotFoundError("Sala");
  }

  return room;
}

/**
 * Crea la sala y materializa su mapa de butacas fisico (Seat) en la misma
 * transaccion. totalCapacity NUNCA se recibe del cliente - se calcula de la
 * suma real de butacas generadas, para que no pueda desincronizarse del
 * mapa real (ver docs/backend/03-cines-salas.md).
 */
export async function createRoom(cinemaId: string, input: CreateRoomInput): Promise<Room> {
  const cinema = await prisma.cinema.findUnique({ where: { id: cinemaId } });
  if (!cinema) {
    throw new NotFoundError("Cine");
  }

  const seatTypeIds = [...new Set(input.rows.map((r) => r.seatTypeId))];
  const existingSeatTypes = await prisma.seatType.findMany({ where: { id: { in: seatTypeIds } } });
  if (existingSeatTypes.length !== seatTypeIds.length) {
    throw new NotFoundError("Uno o más tipos de butaca");
  }

  const existingRoom = await prisma.room.findFirst({ where: { cinemaId, name: input.name } });
  if (existingRoom) {
    throw new ConflictError("Ya existe una sala con ese nombre en este cine");
  }

  const totalCapacity = input.rows.reduce((sum, row) => sum + row.seatCount, 0);

  return prisma.$transaction(async (tx) => {
    const room = await tx.room.create({
      data: { cinemaId, name: input.name, roomType: input.roomType, totalCapacity },
    });

    for (const row of input.rows) {
      await tx.seat.createMany({
        data: Array.from({ length: row.seatCount }, (_, i) => ({
          roomId: room.id,
          rowLabel: row.rowLabel.toUpperCase(),
          seatNumber: i + 1,
          seatTypeId: row.seatTypeId,
        })),
      });
    }

    return room;
  });
}

export async function updateRoom(id: string, input: UpdateRoomInput): Promise<Room> {
  const existing = await prisma.room.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Sala");
  }
  return prisma.room.update({ where: { id }, data: input });
}
