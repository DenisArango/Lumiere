import argon2 from "argon2";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const app = createApp();
const suffix = Date.now();
const password = "Sup3rSecret!";

const adminEmail = `test.reports.admin.${suffix}@lumiere.test`;
const customerEmail = `test.reports.customer.${suffix}@lumiere.test`;

let adminCookies: { access: string; csrf: string };
let customerCookies: { access: string; csrf: string };
let cinemaId: string;
let roomId: string;
let movieAId: string;
let movieBId: string;
let personId: string;
let genreId: string;
let showtimeAId: string;
let showtimeBId: string;
let promoUsedId: string;
let promoUnusedId: string;
let rangeFrom: string;
let rangeTo: string;

function extractCookie(cookies: string | string[] | undefined, name: string): string {
  const arr = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
  const raw = arr.find((c) => c.startsWith(`${name}=`));
  const value = raw?.split(";")[0]?.split("=")[1];
  if (!value) throw new Error(`Cookie ${name} no encontrada`);
  return value;
}

async function loginAs(email: string) {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password });
  const cookies = res.get("set-cookie");
  return { access: extractCookie(cookies, "access_token"), csrf: extractCookie(cookies, "csrf_token") };
}

function withAuth(req: request.Test, c: { access: string; csrf: string }): request.Test {
  return req
    .set("Cookie", [`access_token=${c.access}`, `csrf_token=${c.csrf}`])
    .set("x-csrf-token", c.csrf);
}

beforeAll(async () => {
  const passwordHash = await argon2.hash(password);
  await prisma.user.create({
    data: { email: adminEmail, passwordHash, firstName: "Admin", lastName: "Reportes", role: "SUPER_ADMIN" },
  });
  await prisma.user.create({
    data: { email: customerEmail, passwordHash, firstName: "Cliente", lastName: "Reportes" },
  });
  adminCookies = await loginAs(adminEmail);
  customerCookies = await loginAs(customerEmail);

  const rating = await prisma.movieRating.findFirstOrThrow();
  const language = await prisma.language.findFirstOrThrow();
  const seatType = await prisma.seatType.findFirstOrThrow();
  const buyer = await prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });

  const cinema = await prisma.cinema.create({
    data: { name: `Cine reportes ${suffix}`, address: "Av 1", city: "Ciudad", state: "Edo", country: "País" },
  });
  cinemaId = cinema.id;
  const room = await prisma.room.create({
    data: { cinemaId, name: "Sala reportes", roomType: "STANDARD", totalCapacity: 3 },
  });
  roomId = room.id;
  const seats = await Promise.all(
    [1, 2, 3].map((n) =>
      prisma.seat.create({ data: { roomId, rowLabel: "A", seatNumber: n, seatTypeId: seatType.id } }),
    ),
  );

  const person = await prisma.person.create({ data: { firstName: "Dir", lastName: `Reportes${suffix}` } });
  personId = person.id;
  const genre = await prisma.genre.create({ data: { name: `Género reportes ${suffix}` } });
  genreId = genre.id;

  const movieData = {
    synopsis: "Sinopsis",
    durationMinutes: 90,
    releaseYear: 2026,
    countryOfOrigin: "México",
    ratingId: rating.id,
    originalLanguageId: language.id,
    genres: { create: [{ genreId }] },
    credits: { create: [{ personId, creditRole: "DIRECTOR" as const }] },
  };

  const movieA = await prisma.movie.create({ data: { title: `Popular A ${suffix}`, ...movieData } });
  movieAId = movieA.id;
  const movieB = await prisma.movie.create({ data: { title: `Popular B ${suffix}`, ...movieData } });
  movieBId = movieB.id;

  // Horarios fijos y controlados (UTC) para probar los buckets de demanda.
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const startA = new Date(tomorrow);
  startA.setUTCHours(14, 0, 0, 0);
  const startB = new Date(tomorrow);
  startB.setUTCHours(20, 0, 0, 0);

  const showtimeA = await prisma.showtime.create({
    data: {
      movieId: movieAId,
      roomId,
      audioLanguageId: language.id,
      startTime: startA,
      endTime: new Date(startA.getTime() + 110 * 60 * 1000),
      basePrice: 100,
      format: "TWO_D",
    },
  });
  showtimeAId = showtimeA.id;

  const showtimeB = await prisma.showtime.create({
    data: {
      movieId: movieBId,
      roomId,
      audioLanguageId: language.id,
      startTime: startB,
      endTime: new Date(startB.getTime() + 110 * 60 * 1000),
      basePrice: 100,
      format: "TWO_D",
    },
  });
  showtimeBId = showtimeB.id;

  const showtimeSeatsA = await Promise.all(
    seats
      .slice(0, 2)
      .map((s) => prisma.showtimeSeat.create({ data: { showtimeId: showtimeAId, seatId: s.id, status: "SOLD" } })),
  );
  const showtimeSeatB = await prisma.showtimeSeat.create({
    data: { showtimeId: showtimeBId, seatId: seats[2]!.id, status: "SOLD" },
  });

  const promoUsed = await prisma.promotion.create({
    data: {
      name: "Usada en reportes",
      code: `USED${suffix}`,
      discountType: "FIXED",
      discountValue: 25,
      startDate: new Date(Date.now() - 86_400_000),
      endDate: new Date(Date.now() + 86_400_000),
    },
  });
  promoUsedId = promoUsed.id;
  const promoUnused = await prisma.promotion.create({
    data: {
      name: "Sin uso en reportes",
      code: `UNUSED${suffix}`,
      discountType: "FIXED",
      discountValue: 10,
      startDate: new Date(Date.now() - 86_400_000),
      endDate: new Date(Date.now() + 86_400_000),
    },
  });
  promoUnusedId = promoUnused.id;

  rangeFrom = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Orden pagada: 2 boletos de la pelicula A, usa la promocion.
  await prisma.order.create({
    data: {
      userId: buyer.id,
      showtimeId: showtimeAId,
      status: "PAID",
      promotionId: promoUsedId,
      subtotal: 200,
      discountAmount: 25,
      totalAmount: 175,
      seats: {
        create: showtimeSeatsA.map((s) => ({ showtimeSeatId: s.id, priceAtPurchase: 100 })),
      },
    },
  });

  // Orden pagada: 1 boleto de la pelicula B, sin promocion.
  await prisma.order.create({
    data: {
      userId: buyer.id,
      showtimeId: showtimeBId,
      status: "PAID",
      subtotal: 100,
      discountAmount: 0,
      totalAmount: 100,
      seats: { create: [{ showtimeSeatId: showtimeSeatB.id, priceAtPurchase: 100 }] },
    },
  });

  rangeTo = new Date(Date.now() + 60 * 60 * 1000).toISOString();
});

afterAll(async () => {
  await prisma.orderSeat.deleteMany({ where: { showtimeSeat: { showtimeId: { in: [showtimeAId, showtimeBId] } } } });
  await prisma.order.deleteMany({ where: { showtimeId: { in: [showtimeAId, showtimeBId] } } });
  await prisma.showtimeSeat.deleteMany({ where: { showtimeId: { in: [showtimeAId, showtimeBId] } } });
  await prisma.showtime.deleteMany({ where: { id: { in: [showtimeAId, showtimeBId] } } });
  await prisma.promotion.deleteMany({ where: { id: { in: [promoUsedId, promoUnusedId] } } });
  await prisma.movie.deleteMany({ where: { id: { in: [movieAId, movieBId] } } });
  await prisma.person.deleteMany({ where: { id: personId } });
  await prisma.genre.deleteMany({ where: { id: genreId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.cinema.deleteMany({ where: { id: cinemaId } });
  await prisma.user.deleteMany({ where: { email: { in: [adminEmail, customerEmail] } } });
  await prisma.$disconnect();
  await redis.quit().catch(() => undefined);
});

describe("Reportería", () => {
  it("rechaza acceso a CUSTOMER (RBAC)", async () => {
    const res = await withAuth(request(app).get("/api/v1/reports/most-viewed-movies"), customerCookies);
    expect(res.status).toBe(403);
  });

  it("rechaza acceso sin autenticación", async () => {
    const res = await request(app).get("/api/v1/reports/most-viewed-movies");
    expect(res.status).toBe(401);
  });

  it("películas más vistas: A (2 boletos) aparece antes que B (1 boleto)", async () => {
    const res = await withAuth(
      request(app).get(`/api/v1/reports/most-viewed-movies?from=${rangeFrom}&to=${rangeTo}`),
      adminCookies,
    );
    expect(res.status).toBe(200);
    const own = res.body.movies.filter((m: { movieId: string }) =>
      [movieAId, movieBId].includes(m.movieId),
    );
    expect(own[0]).toMatchObject({ movieId: movieAId, ticketsSold: 2 });
    expect(own[1]).toMatchObject({ movieId: movieBId, ticketsSold: 1 });
  });

  it("horarios de mayor demanda: hora 14 (2 boletos) supera a la hora 20 (1 boleto)", async () => {
    const res = await withAuth(
      request(app).get(`/api/v1/reports/peak-demand?from=${rangeFrom}&to=${rangeTo}`),
      adminCookies,
    );
    expect(res.status).toBe(200);
    const hour14 = res.body.byHourOfDay.find((h: { hourOfDay: number }) => h.hourOfDay === 14);
    const hour20 = res.body.byHourOfDay.find((h: { hourOfDay: number }) => h.hourOfDay === 20);
    expect(hour14.ticketsSold).toBe(2);
    expect(hour20.ticketsSold).toBe(1);
  });

  it("efectividad de promociones: la usada muestra 1 uso y $25 de descuento otorgado, la no usada muestra 0", async () => {
    const res = await withAuth(
      request(app).get(`/api/v1/reports/promotion-effectiveness?from=${rangeFrom}&to=${rangeTo}&limit=50`),
      adminCookies,
    );
    expect(res.status).toBe(200);
    const used = res.body.promotions.find((p: { promotionId: string }) => p.promotionId === promoUsedId);
    const unused = res.body.promotions.find(
      (p: { promotionId: string }) => p.promotionId === promoUnusedId,
    );
    expect(used).toMatchObject({ timesUsed: 1, totalDiscountGranted: 25, totalRevenue: 175 });
    expect(unused).toMatchObject({ timesUsed: 0, totalDiscountGranted: 0, totalRevenue: 0 });
  });
});
