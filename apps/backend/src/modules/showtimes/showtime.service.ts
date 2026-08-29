import type { Showtime } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/utils/app-error";
import { paginate, toSkipTake, type PaginatedResult } from "@/utils/pagination";
import type {
  CreateShowtimeInput,
  ListShowtimesQuery,
  UpdateShowtimeInput,
} from "@/modules/showtimes/showtime.schema";
import { sweepExpiredLocks } from "@/modules/bookings/booking.service";

/**
 * Minutos de limpieza/trailers entre el fin de una funcion y el inicio de
 * la siguiente en la misma sala. Decision de negocio, no de infraestructura
 * - se mantiene como constante de codigo en vez de variable de entorno.
 */
const ROOM_TURNAROUND_MINUTES = 20;

const detailInclude = {
  movie: { select: { id: true, title: true, posterUrl: true, durationMinutes: true } },
  room: {
    select: {
      id: true,
      name: true,
      roomType: true,
      cinema: { select: { id: true, name: true, city: true } },
    },
  },
  audioLanguage: true,
  subtitleLanguage: true,
} as const;

export async function listShowtimes(query: ListShowtimesQuery): Promise<PaginatedResult<unknown>> {
  const dateFilter = query.date
    ? {
        startTime: {
          gte: new Date(`${query.date}T00:00:00.000Z`),
          lt: new Date(`${query.date}T23:59:59.999Z`),
        },
      }
    : {};

  const where = {
    status: "SCHEDULED" as const,
    ...(query.movieId ? { movieId: query.movieId } : {}),
    ...(query.roomId ? { roomId: query.roomId } : {}),
    ...(query.cinemaId ? { room: { cinemaId: query.cinemaId } } : {}),
    ...dateFilter,
  };

  const [rows, total] = await Promise.all([
    prisma.showtime.findMany({
      where,
      include: detailInclude,
      orderBy: { startTime: "asc" },
      ...toSkipTake(query),
    }),
    prisma.showtime.count({ where }),
  ]);

  const rowsWithAvailability = await Promise.all(
    rows.map(async (showtime) => {
      // Sin esto, un bloqueo vencido seguiria contando como no-disponible
      // para cualquiera que solo consulte la cartelera sin intentar
      // reservar (ver docs/backend/05-reservas.md).
      await sweepExpiredLocks(showtime.id);
      const availableSeats = await prisma.showtimeSeat.count({
        where: { showtimeId: showtime.id, status: "AVAILABLE" },
      });
      return { ...showtime, availableSeats };
    }),
  );

  return paginate(rowsWithAvailability, total, query);
}

export async function getShowtimeById(id: string) {
  const showtime = await prisma.showtime.findUnique({ where: { id }, include: detailInclude });
  if (!showtime) {
    throw new NotFoundError("Función");
  }

  await sweepExpiredLocks(id);
  const availableSeats = await prisma.showtimeSeat.count({
    where: { showtimeId: id, status: "AVAILABLE" },
  });

  return { ...showtime, availableSeats };
}

export async function createShowtime(input: CreateShowtimeInput): Promise<Showtime> {
  const [movie, room] = await Promise.all([
    prisma.movie.findUnique({ where: { id: input.movieId } }),
    prisma.room.findUnique({ where: { id: input.roomId }, include: { seats: true } }),
  ]);

  if (!movie) throw new NotFoundError("Película");
  if (!room) throw new NotFoundError("Sala");

  const endTime = new Date(
    input.startTime.getTime() + (movie.durationMinutes + ROOM_TURNAROUND_MINUTES) * 60_000,
  );

  const overlapping = await prisma.showtime.findFirst({
    where: {
      roomId: input.roomId,
      status: "SCHEDULED",
      startTime: { lt: endTime },
      endTime: { gt: input.startTime },
    },
  });

  if (overlapping) {
    throw new ConflictError(
      "Ya existe una función programada en esa sala que se cruza con este horario",
    );
  }

  return prisma.$transaction(async (tx) => {
    const showtime = await tx.showtime.create({
      data: {
        movieId: input.movieId,
        roomId: input.roomId,
        audioLanguageId: input.audioLanguageId,
        subtitleLanguageId: input.subtitleLanguageId,
        startTime: input.startTime,
        endTime,
        basePrice: input.basePrice,
        format: input.format,
      },
    });

    // Materializa la disponibilidad de cada butaca fisica de la sala para
    // ESTA funcion especifica - ver docs/04-modelo-datos.md seccion 3 sobre
    // por que ShowtimeSeat es una entidad separada de Seat.
    await tx.showtimeSeat.createMany({
      data: room.seats.map((seat) => ({
        showtimeId: showtime.id,
        seatId: seat.id,
        status: "AVAILABLE" as const,
      })),
    });

    return showtime;
  });
}

export async function updateShowtime(id: string, input: UpdateShowtimeInput): Promise<Showtime> {
  const existing = await prisma.showtime.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Función");
  }
  return prisma.showtime.update({ where: { id }, data: input });
}
