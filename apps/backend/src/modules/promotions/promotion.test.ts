import argon2 from "argon2";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const app = createApp();
const suffix = Date.now();
const password = "Sup3rSecret!";

const adminEmail = `test.promo.admin.${suffix}@lumiere.test`;
const customerEmail = `test.promo.customer.${suffix}@lumiere.test`;

let adminCookies: { access: string; csrf: string };
let customerCookies: { access: string; csrf: string };
let cinemaId: string;
let roomId: string;
let movieId: string;
let personId: string;
let genreId: string;
let showtimeId: string;
let seatId: string;
let promotionId: string;
const promoCode = `PROMO${suffix}`;

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
    data: { email: adminEmail, passwordHash, firstName: "Admin", lastName: "Promo", role: "SUPER_ADMIN" },
  });
  await prisma.user.create({
    data: { email: customerEmail, passwordHash, firstName: "Cliente", lastName: "Promo" },
  });

  adminCookies = await loginAs(adminEmail);
  customerCookies = await loginAs(customerEmail);

  const rating = await prisma.movieRating.findFirstOrThrow();
  const language = await prisma.language.findFirstOrThrow();
  const seatType = await prisma.seatType.findFirstOrThrow();

  const cinema = await prisma.cinema.create({
    data: { name: `Cine promo ${suffix}`, address: "Av 1", city: "Ciudad", state: "Edo", country: "País" },
  });
  cinemaId = cinema.id;

  const room = await prisma.room.create({
    data: { cinemaId, name: "Sala promo", roomType: "STANDARD", totalCapacity: 1 },
  });
  roomId = room.id;
  const seat = await prisma.seat.create({
    data: { roomId, rowLabel: "A", seatNumber: 1, seatTypeId: seatType.id },
  });
  seatId = seat.id;

  const person = await prisma.person.create({ data: { firstName: "Dir", lastName: `Promo${suffix}` } });
  personId = person.id;
  const genre = await prisma.genre.create({ data: { name: `Género promo ${suffix}` } });
  genreId = genre.id;

  const movie = await prisma.movie.create({
    data: {
      title: `Película promo ${suffix}`,
      synopsis: "Sinopsis",
      durationMinutes: 90,
      releaseYear: 2026,
      countryOfOrigin: "México",
      ratingId: rating.id,
      originalLanguageId: language.id,
      genres: { create: [{ genreId }] },
      credits: { create: [{ personId, creditRole: "DIRECTOR" }] },
    },
  });
  movieId = movie.id;

  const showtime = await prisma.showtime.create({
    data: {
      movieId,
      roomId,
      audioLanguageId: language.id,
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 110 * 60 * 1000),
      basePrice: 200,
      format: "TWO_D",
    },
  });
  showtimeId = showtime.id;
  await prisma.showtimeSeat.create({ data: { showtimeId, seatId, status: "AVAILABLE" } });
});

afterAll(async () => {
  await prisma.orderSeat.deleteMany({ where: { showtimeSeat: { showtimeId } } });
  await prisma.order.deleteMany({ where: { showtimeId } });
  await prisma.showtimeSeat.deleteMany({ where: { showtimeId } });
  await prisma.showtime.deleteMany({ where: { id: showtimeId } });
  await prisma.promotionRule.deleteMany({ where: { promotionId } });
  await prisma.promotion.deleteMany({ where: { id: promotionId } });
  await prisma.movie.deleteMany({ where: { id: movieId } });
  await prisma.person.deleteMany({ where: { id: personId } });
  await prisma.genre.deleteMany({ where: { id: genreId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.cinema.deleteMany({ where: { id: cinemaId } });
  await prisma.user.deleteMany({ where: { email: { in: [adminEmail, customerEmail] } } });
  await prisma.$disconnect();
  await redis.quit().catch(() => undefined);
});

describe("Promociones — administración", () => {
  it("rechaza descuento porcentual mayor a 100", async () => {
    const res = await withAuth(request(app).post("/api/v1/promotions"), adminCookies).send({
      name: "Promo inválida",
      code: `INVALID${suffix}`,
      discountType: "PERCENTAGE",
      discountValue: 150,
      startDate: new Date(Date.now() - 86_400_000).toISOString(),
      endDate: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(res.status).toBe(422);
  });

  it("crea una promoción de 20% para la película de prueba", async () => {
    const res = await withAuth(request(app).post("/api/v1/promotions"), adminCookies).send({
      name: "20% en película de prueba",
      code: promoCode,
      discountType: "PERCENTAGE",
      discountValue: 20,
      startDate: new Date(Date.now() - 86_400_000).toISOString(),
      endDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      rules: [{ movieId }],
    });
    expect(res.status).toBe(201);
    promotionId = res.body.promotion.id;
  });

  it("rechaza crear una promoción con código duplicado", async () => {
    const res = await withAuth(request(app).post("/api/v1/promotions"), adminCookies).send({
      name: "Duplicada",
      code: promoCode,
      discountType: "FIXED",
      discountValue: 10,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(res.status).toBe(409);
  });

  it("aparece en el listado público de promociones activas", async () => {
    const res = await request(app).get("/api/v1/promotions");
    expect(res.status).toBe(200);
    expect(res.body.promotions.some((p: { id: string }) => p.id === promotionId)).toBe(true);
  });
});

describe("Promociones — validación y aplicación en orden real", () => {
  it("/validate confirma que el código aplica a la función", async () => {
    const res = await withAuth(request(app).post("/api/v1/promotions/validate"), customerCookies).send({
      code: promoCode,
      showtimeId,
    });
    expect(res.status).toBe(200);
    expect(res.body.promotion.code).toBe(promoCode);
  });

  it("/validate rechaza un código inexistente", async () => {
    const res = await withAuth(request(app).post("/api/v1/promotions/validate"), customerCookies).send({
      code: "NOEXISTE",
      showtimeId,
    });
    expect(res.status).toBe(404);
  });

  it("crear una orden con el código aplica el 20% de descuento correctamente", async () => {
    const showtimeSeat = await prisma.showtimeSeat.findFirstOrThrow({ where: { showtimeId } });

    const lockRes = await withAuth(
      request(app).post(`/api/v1/showtimes/${showtimeId}/seats/lock`),
      customerCookies,
    ).send({ seatIds: [showtimeSeat.id] });
    expect(lockRes.status).toBe(200);

    const orderRes = await withAuth(request(app).post("/api/v1/orders"), customerCookies).send({
      showtimeId,
      seatIds: [showtimeSeat.id],
      promotionCode: promoCode,
    });

    expect(orderRes.status).toBe(201);
    // basePrice 200 * multiplicador estandar 1 = 200 subtotal, 20% descuento = 40
    expect(Number(orderRes.body.order.subtotal)).toBe(200);
    expect(Number(orderRes.body.order.discountAmount)).toBe(40);
    expect(Number(orderRes.body.order.totalAmount)).toBe(160);
  });
});
