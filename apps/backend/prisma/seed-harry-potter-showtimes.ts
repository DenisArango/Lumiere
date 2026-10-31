/**
 * Lumière · Festival Harry Potter — funciones de DEMOSTRACIÓN.
 * Ejecutar SOLO contra base de datos de desarrollo local:
 *   cd apps/backend
 *   pnpm exec tsx prisma/seed-harry-potter-showtimes.ts
 *
 * Crea un cine demo aislado, 6 salas, 32 asientos por sala y
 * 3 funciones diarias por película durante los próximos 7 días.
 * No borra nada; se puede ejecutar de nuevo sin duplicar funciones.
 * Todos los horarios son de Guatemala (UTC−06:00).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CINEMA_NAME = "Lumière · Festival Harry Potter (DEMO)";
const DIAS = 7;
const FILMS = [
  "Harry Potter y la piedra filosofal",
  "Harry Potter y la cámara secreta",
  "Harry Potter y el prisionero de Azkaban",
  "Harry Potter y el cáliz de fuego",
  "Harry Potter y la Orden del Fénix",
  "Harry Potter y el misterio del príncipe",
  "Harry Potter y las reliquias de la Muerte: parte 1",
  "Harry Potter y las reliquias de la Muerte: parte 2",
] as const;

const SLOTS = [
  { hora: "10:30", precio: 45 },
  { hora: "14:15", precio: 55 },
  { hora: "18:00", precio: 65 },
  { hora: "21:45", precio: 65 },
] as const;

function todayInGuatemala(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (name: string) => Number(parts.find((p) => p.type === name)?.value);
  // Fecha de calendario (no instante) representada en UTC para sumar días.
  return new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
}

function gtDate(day: Date, hhmm: string): Date {
  // Guatemala no utiliza horario de verano.
  const date = day.toISOString().slice(0, 10);
  return new Date(`${date}T${hhmm}:00-06:00`);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Este script de demostración no debe ejecutarse en producción.");
  }

  // Verificar las 8 películas ANTES de crear cualquier cine o sala.
  const movies = await Promise.all(
    FILMS.map(async (title) => {
      const movie = await prisma.movie.findFirst({ where: { title } });
      if (!movie) {
        throw new Error(`No existe: ${title}. Ejecuta primero seed-harry-potter.ts.`);
      }
      return movie;
    }),
  );

  const english = await prisma.language.findUnique({ where: { code: "en" } });
  const spanish = await prisma.language.findUnique({ where: { code: "es" } });
  if (!english) throw new Error("Falta idioma 'en' en el catálogo Language.");

  const standard = await prisma.seatType.upsert({
    where: { name: "Estándar" },
    update: {},
    create: { name: "Estándar", priceMultiplier: 1 },
  });
  const vip = await prisma.seatType.findUnique({ where: { name: "VIP" } });

  // Cine de DEMO separado, sin alterar los cines del equipo.
  let cinema = await prisma.cinema.findFirst({ where: { name: CINEMA_NAME } });
  if (!cinema) {
    cinema = await prisma.cinema.create({
      data: {
        name: CINEMA_NAME,
        address: "Cine de demostración — sin sede física",
        city: "Ciudad de Guatemala",
        state: "Guatemala",
        country: "Guatemala",
        isActive: true,
      },
    });
  }

  const rooms = [];
  const seatsByRoom = new Map<string, string[]>();
  for (let roomIndex = 0; roomIndex < 6; roomIndex++) {
    const room = await prisma.room.upsert({
      where: {
        cinemaId_name: {
          cinemaId: cinema.id,
          name: `Sala HP ${roomIndex + 1}`,
        },
      },
      update: {},
      create: {
        cinemaId: cinema.id,
        name: `Sala HP ${roomIndex + 1}`,
        roomType: "STANDARD",
        totalCapacity: 32,
      },
    });
    rooms.push(room);

    // 4 filas (A–D) x 8 asientos. Fila D VIP si existe el catálogo.
    const seatData = ["A", "B", "C", "D"].flatMap((rowLabel) =>
      Array.from({ length: 8 }, (_, index) => ({
        roomId: room.id,
        rowLabel,
        seatNumber: index + 1,
        seatTypeId: rowLabel === "D" && vip ? vip.id : standard.id,
        isActive: true,
      })),
    );
    await prisma.seat.createMany({ data: seatData, skipDuplicates: true });
    const seats = await prisma.seat.findMany({
      where: { roomId: room.id, isActive: true },
      select: { id: true },
    });
    seatsByRoom.set(room.id, seats.map((seat) => seat.id));
  }

  let creadas = 0;
  let existentes = 0;
  let conflictos = 0;
  const today = todayInGuatemala();
  const now = Date.now();

  for (let dayOffset = 0; dayOffset < DIAS; dayOffset++) {
    const day = new Date(today.getTime() + dayOffset * 86_400_000);

    for (let slotIndex = 0; slotIndex < SLOTS.length; slotIndex++) {
      const slot = SLOTS[slotIndex];
      const startTime = gtDate(day, slot.hora);
      if (startTime.getTime() <= now + 10 * 60_000) continue;

      for (let roomIndex = 0; roomIndex < rooms.length; roomIndex++) {
        // 6 salas × 4 franjas = 24 funciones/día = 3 por película.
        // Una sala nunca tiene dos películas simultáneas.
        const movieIndex = (roomIndex + 2 * slotIndex) % movies.length;
        const movie = movies[movieIndex];
        const room = rooms[roomIndex];
        const seatIds = seatsByRoom.get(room.id) ?? [];
        const endTime = new Date(
          startTime.getTime() + (movie.durationMinutes + 20) * 60_000,
        );

        const existing = await prisma.showtime.findFirst({
          where: { movieId: movie.id, roomId: room.id, startTime },
          select: { id: true },
        });
        if (existing) {
          // Completa asientos faltantes sin cambiar ventas o bloqueos existentes.
          await prisma.showtimeSeat.createMany({
            data: seatIds.map((seatId) => ({ showtimeId: existing.id, seatId })),
            skipDuplicates: true,
          });
          existentes++;
          continue;
        }

        const overlap = await prisma.showtime.findFirst({
          where: {
            roomId: room.id,
            status: { not: "CANCELLED" },
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
          select: { id: true },
        });
        if (overlap) {
          conflictos++;
          console.warn(`Conflicto de sala omitido: ${room.name}, ${startTime.toISOString()}`);
          continue;
        }

        await prisma.$transaction(async (tx) => {
          const showtime = await tx.showtime.create({
            data: {
              movieId: movie.id,
              roomId: room.id,
              audioLanguageId: english.id,
              subtitleLanguageId: spanish?.id ?? null,
              startTime,
              endTime,
              basePrice: slot.precio,
              format: "TWO_D",
              status: "SCHEDULED",
            },
          });
          await tx.showtimeSeat.createMany({
            data: seatIds.map((seatId) => ({
              showtimeId: showtime.id,
              seatId,
              status: "AVAILABLE" as const,
            })),
            skipDuplicates: true,
          });
        });
        creadas++;
      }
    }
  }

  console.log("\n🎬 Lumière: Festival Harry Potter (DEMO)");
  console.log(`Cine: ${cinema.name} | 6 salas | hasta 3 funciones diarias por película`);
  console.log(`Funciones creadas: ${creadas}`);
  console.log(`Funciones ya existentes: ${existentes}`);
  console.log(`Conflictos de sala omitidos: ${conflictos}`);
  console.log("Horarios en Guatemala: 10:30, 14:15, 18:00 y 21:45 (distribuidos por película).");
  console.log("Recarga la cartelera en http://localhost:5173 y entra a 'Ver funciones'.");
}

main()
  .catch((error) => {
    console.error("No se pudo crear la programación:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
