import argon2 from "argon2";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const app = createApp();
const suffix = Date.now();
const password = "Sup3rSecret!";

const adminEmail = `test.review.admin.${suffix}@lumiere.test`;
const buyerEmail = `test.review.buyer.${suffix}@lumiere.test`;
const otherEmail = `test.review.other.${suffix}@lumiere.test`;

let adminCookies: { access: string; csrf: string };
let buyerCookies: { access: string; csrf: string };
let otherCookies: { access: string; csrf: string };
let movieId: string;
let cinemaId: string;
let roomId: string;
let personId: string;
let genreId: string;
let showtimeId: string;
let reviewId: string;

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
    data: { email: adminEmail, passwordHash, firstName: "Admin", lastName: "Review", role: "SUPER_ADMIN" },
  });
  await prisma.user.create({
    data: { email: buyerEmail, passwordHash, firstName: "Compradora", lastName: "Review" },
  });
  await prisma.user.create({
    data: { email: otherEmail, passwordHash, firstName: "Otra", lastName: "Persona" },
  });

  adminCookies = await loginAs(adminEmail);
  buyerCookies = await loginAs(buyerEmail);
  otherCookies = await loginAs(otherEmail);

  const rating = await prisma.movieRating.findFirstOrThrow();
  const language = await prisma.language.findFirstOrThrow();
  const seatType = await prisma.seatType.findFirstOrThrow();

  const cinema = await prisma.cinema.create({
    data: { name: `Cine reseñas ${suffix}`, address: "Av 1", city: "Ciudad", state: "Edo", country: "País" },
  });
  cinemaId = cinema.id;
  const room = await prisma.room.create({
    data: { cinemaId, name: "Sala reseñas", roomType: "STANDARD", totalCapacity: 1 },
  });
  roomId = room.id;
  const seat = await prisma.seat.create({
    data: { roomId, rowLabel: "A", seatNumber: 1, seatTypeId: seatType.id },
  });

  const person = await prisma.person.create({ data: { firstName: "Dir", lastName: `Reseñas${suffix}` } });
  personId = person.id;
  const genre = await prisma.genre.create({ data: { name: `Género reseñas ${suffix}` } });
  genreId = genre.id;

  const movie = await prisma.movie.create({
    data: {
      title: `Película reseñas ${suffix}`,
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
      basePrice: 100,
      format: "TWO_D",
    },
  });
  showtimeId = showtime.id;
  const showtimeSeat = await prisma.showtimeSeat.create({
    data: { showtimeId, seatId: seat.id, status: "SOLD" },
  });

  // Simula una compra PAGADA de la compradora, ya que el modulo de pagos aun
  // no existe - ver docs/backend/07-opiniones.md.
  const buyer = await prisma.user.findUniqueOrThrow({ where: { email: buyerEmail } });
  await prisma.order.create({
    data: {
      userId: buyer.id,
      showtimeId,
      status: "PAID",
      subtotal: 100,
      discountAmount: 0,
      totalAmount: 100,
      seats: { create: [{ showtimeSeatId: showtimeSeat.id, priceAtPurchase: 100 }] },
    },
  });
});

afterAll(async () => {
  await prisma.review.deleteMany({ where: { movieId } });
  await prisma.orderSeat.deleteMany({ where: { showtimeSeat: { showtimeId } } });
  await prisma.order.deleteMany({ where: { showtimeId } });
  await prisma.showtimeSeat.deleteMany({ where: { showtimeId } });
  await prisma.showtime.deleteMany({ where: { id: showtimeId } });
  await prisma.movie.deleteMany({ where: { id: movieId } });
  await prisma.person.deleteMany({ where: { id: personId } });
  await prisma.genre.deleteMany({ where: { id: genreId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.cinema.deleteMany({ where: { id: cinemaId } });
  await prisma.user.deleteMany({ where: { email: { in: [adminEmail, buyerEmail, otherEmail] } } });
  await prisma.$disconnect();
  await redis.quit().catch(() => undefined);
});

describe("Opiniones", () => {
  it("rechaza calificación fuera de rango", async () => {
    const res = await withAuth(request(app).post(`/api/v1/movies/${movieId}/reviews`), buyerCookies).send({
      rating: 7,
    });
    expect(res.status).toBe(422);
  });

  it("la compradora deja una reseña verificada (tiene orden PAID de esa película)", async () => {
    const res = await withAuth(request(app).post(`/api/v1/movies/${movieId}/reviews`), buyerCookies).send({
      rating: 5,
      comment: "Excelente función, la sala impecable.",
    });
    expect(res.status).toBe(201);
    expect(res.body.review.isVerifiedPurchase).toBe(true);
    reviewId = res.body.review.id;
  });

  it("otra persona sin compra deja una reseña NO verificada", async () => {
    const res = await withAuth(request(app).post(`/api/v1/movies/${movieId}/reviews`), otherCookies).send({
      rating: 3,
      comment: "Se ve bien pero no fui.",
    });
    expect(res.status).toBe(201);
    expect(res.body.review.isVerifiedPurchase).toBe(false);
  });

  it("rechaza una segunda reseña del mismo usuario para la misma película", async () => {
    const res = await withAuth(request(app).post(`/api/v1/movies/${movieId}/reviews`), buyerCookies).send({
      rating: 4,
    });
    expect(res.status).toBe(409);
  });

  it("el listado público de reseñas incluye ambas", async () => {
    const res = await request(app).get(`/api/v1/movies/${movieId}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  it("el detalle de la película muestra el promedio y el conteo de reseñas", async () => {
    const res = await request(app).get(`/api/v1/movies/${movieId}`);
    expect(res.status).toBe(200);
    expect(res.body.movie.reviewCount).toBe(2);
    expect(res.body.movie.averageRating).toBe(4); // (5 + 3) / 2
  });

  it("otro usuario no puede editar la reseña ajena", async () => {
    const res = await withAuth(request(app).patch(`/api/v1/reviews/${reviewId}`), otherCookies).send({
      rating: 1,
    });
    expect(res.status).toBe(403);
  });

  it("la autora sí puede editar su propia reseña", async () => {
    const res = await withAuth(request(app).patch(`/api/v1/reviews/${reviewId}`), buyerCookies).send({
      rating: 4,
    });
    expect(res.status).toBe(200);
    expect(res.body.review.rating).toBe(4);
  });

  it("un CUSTOMER no puede moderar reseñas", async () => {
    const res = await withAuth(
      request(app).patch(`/api/v1/reviews/${reviewId}/moderate`),
      buyerCookies,
    ).send({ isApproved: false });
    expect(res.status).toBe(403);
  });

  it("SUPER_ADMIN puede ocultar una reseña y deja de aparecer en el listado público", async () => {
    const modRes = await withAuth(
      request(app).patch(`/api/v1/reviews/${reviewId}/moderate`),
      adminCookies,
    ).send({ isApproved: false });
    expect(modRes.status).toBe(200);

    const listRes = await request(app).get(`/api/v1/movies/${movieId}/reviews`);
    expect(listRes.body.total).toBe(1);
  });
});
