import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Datos de DEMOSTRACION para validacion manual en un entorno de
 * desarrollo local - NO es el seed de datos de referencia (prisma/seed.ts,
 * que se mantiene deliberadamente libre de datos de negocio de ejemplo,
 * ver docs/backend/00-foundation.md). Este script crea cuentas de prueba
 * por rol y un recorrido completo (pelicula, cine, sala, funcion, combo,
 * promocion, una orden ya pagada) para poder validar la aplicacion de
 * punta a punta sin tener que armar todo a mano desde el panel.
 *
 * Se puede correr mas de una vez de forma segura: borra sus propios
 * registros (identificados por email/codigo/titulo fijos) antes de
 * recrearlos.
 *
 * Uso: pnpm --filter @lumiere/backend prisma:seed-demo
 */

const DEMO_PASSWORD = "Lumiere2026!";
const DEMO_QR_CODE = "LMR-DEMO0001";

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(DEMO_PASSWORD);

  // --- Cuentas de prueba, una por rol relevante -----------------------
  await prisma.user.deleteMany({
    where: { email: { in: ["admin@lumiere.test", "taquilla@lumiere.test", "cliente@lumiere.test"] } },
  });
  const admin = await prisma.user.create({
    data: {
      email: "admin@lumiere.test",
      passwordHash,
      firstName: "Admin",
      lastName: "Demo",
      role: "SUPER_ADMIN",
      emailVerifiedAt: new Date(),
    },
  });
  await prisma.user.create({
    data: {
      email: "taquilla@lumiere.test",
      passwordHash,
      firstName: "Taquilla",
      lastName: "Demo",
      role: "BOX_OFFICE",
      emailVerifiedAt: new Date(),
    },
  });
  const cliente = await prisma.user.create({
    data: {
      email: "cliente@lumiere.test",
      passwordHash,
      firstName: "Cliente",
      lastName: "Demo",
      role: "CUSTOMER",
      loyaltyMember: true,
      loyaltyPoints: 120,
      emailVerifiedAt: new Date(),
    },
  });

  // --- Catalogo ---------------------------------------------------------
  const rating = await prisma.movieRating.findFirstOrThrow({ where: { code: "B" } });
  const language = await prisma.language.findFirstOrThrow({ where: { code: "es" } });
  const actionGenre = await prisma.genre.findFirstOrThrow({ where: { name: "Ciencia ficción" } });
  const dramaGenre = await prisma.genre.findFirstOrThrow({ where: { name: "Drama" } });

  await prisma.person.deleteMany({ where: { firstName: "Elena", lastName: "Duarte Demo" } });
  const director = await prisma.person.create({
    data: { firstName: "Elena", lastName: "Duarte Demo", nationality: "México" },
  });
  await prisma.person.deleteMany({ where: { firstName: "Marco", lastName: "Rivas Demo" } });
  const actor = await prisma.person.create({ data: { firstName: "Marco", lastName: "Rivas Demo" } });

  await prisma.movie.deleteMany({ where: { title: { in: ["Estación Lumière", "Horizonte de Cristal"] } } });

  const nowShowing = await prisma.movie.create({
    data: {
      title: "Estación Lumière",
      synopsis:
        "Una maquinista descubre que la última corrida de la noche la lleva a una estación que no aparece en ningún mapa.",
      durationMinutes: 118,
      releaseYear: 2026,
      countryOfOrigin: "México",
      status: "IN_THEATERS",
      ratingId: rating.id,
      originalLanguageId: language.id,
      genres: { create: [{ genreId: actionGenre.id }] },
      credits: {
        create: [
          { personId: director.id, creditRole: "DIRECTOR" },
          { personId: actor.id, creditRole: "ACTOR", characterName: "Ingeniero Vidal" },
        ],
      },
    },
  });

  await prisma.movie.create({
    data: {
      title: "Horizonte de Cristal",
      synopsis: "Dos hermanas heredan un observatorio abandonado y con él, un secreto de treinta años.",
      durationMinutes: 104,
      releaseYear: 2026,
      countryOfOrigin: "España",
      status: "COMING_SOON",
      ratingId: rating.id,
      originalLanguageId: language.id,
      genres: { create: [{ genreId: dramaGenre.id }] },
      credits: { create: [{ personId: director.id, creditRole: "DIRECTOR" }] },
    },
  });

  // --- Cine, sala y butacas ----------------------------------------------
  await prisma.cinema.deleteMany({ where: { name: "Lumière Reforma" } });
  const seatType = await prisma.seatType.findFirstOrThrow({ where: { name: "Estándar" } });
  const vipSeatType = await prisma.seatType.findFirstOrThrow({ where: { name: "VIP" } });

  const cinema = await prisma.cinema.create({
    data: {
      name: "Lumière Reforma",
      address: "Av. Reforma 222",
      city: "Ciudad de México",
      state: "CDMX",
      country: "México",
      phone: "5555550100",
    },
  });

  const room = await prisma.room.create({
    data: { cinemaId: cinema.id, name: "Sala 1", roomType: "VIP", totalCapacity: 16 },
  });

  await prisma.seat.createMany({
    data: [
      ...Array.from({ length: 8 }, (_, i) => ({
        roomId: room.id,
        rowLabel: "A",
        seatNumber: i + 1,
        seatTypeId: seatType.id,
      })),
      ...Array.from({ length: 8 }, (_, i) => ({
        roomId: room.id,
        rowLabel: "B",
        seatNumber: i + 1,
        seatTypeId: vipSeatType.id,
      })),
    ],
  });

  // --- Funcion (mañana a las 8pm) -----------------------------------------
  await prisma.showtime.deleteMany({ where: { movieId: nowShowing.id } });
  const startTime = new Date();
  startTime.setDate(startTime.getDate() + 1);
  startTime.setHours(20, 0, 0, 0);
  const endTime = new Date(startTime.getTime() + (nowShowing.durationMinutes + 20) * 60_000);

  const showtime = await prisma.showtime.create({
    data: {
      movieId: nowShowing.id,
      roomId: room.id,
      audioLanguageId: language.id,
      startTime,
      endTime,
      basePrice: 95,
      format: "TWO_D",
    },
  });

  const seats = await prisma.seat.findMany({ where: { roomId: room.id } });
  const showtimeSeats = await prisma.showtimeSeat.createManyAndReturn({
    data: seats.map((s) => ({ showtimeId: showtime.id, seatId: s.id, status: "AVAILABLE" as const })),
  });

  // --- Combo de dulceria -----------------------------------------------
  await prisma.product.deleteMany({ where: { name: "Combo Lumière" } });
  const product = await prisma.product.create({
    data: { name: "Combo Lumière", description: "Palomitas grandes + 2 refrescos", price: 89 },
  });

  // --- Promocion ---------------------------------------------------------
  await prisma.promotion.deleteMany({ where: { code: "BIENVENIDA" } });
  await prisma.promotion.create({
    data: {
      name: "Bienvenida Lumière",
      description: "15% de descuento de bienvenida, aplica a cualquier función",
      code: "BIENVENIDA",
      discountType: "PERCENTAGE",
      discountValue: 15,
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
      // sin reglas = promocion global, ver docs/backend/06-promociones.md
    },
  });

  // --- Una orden ya pagada, para probar /taquilla sin depender de --------
  // --- credenciales reales de Stripe/PayPal -------------------------------
  const demoSeat = showtimeSeats[0]!;
  await prisma.showtimeSeat.update({ where: { id: demoSeat.id }, data: { status: "SOLD" } });
  await prisma.order.create({
    data: {
      userId: cliente.id,
      showtimeId: showtime.id,
      status: "PAID",
      subtotal: 95,
      discountAmount: 0,
      totalAmount: 95,
      qrCode: DEMO_QR_CODE,
      seats: { create: [{ showtimeSeatId: demoSeat.id, priceAtPurchase: 95 }] },
      payment: {
        create: { provider: "STRIPE", providerPaymentId: "demo_seed_payment", amount: 95, status: "COMPLETED" },
      },
    },
  });

  // eslint-disable-next-line no-console
  console.log(`
Datos de demostración listos.

Cuentas (contraseña para las 3: ${DEMO_PASSWORD}):
  admin@lumiere.test     SUPER_ADMIN
  taquilla@lumiere.test  BOX_OFFICE
  cliente@lumiere.test   CUSTOMER

Función de prueba: "Estación Lumière" mañana 8:00pm en Lumière Reforma, Sala 1.
Código de promoción: BIENVENIDA (15%)
Boleto ya pagado para validar en /taquilla: ${DEMO_QR_CODE}
  `);

  await prisma.$disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
