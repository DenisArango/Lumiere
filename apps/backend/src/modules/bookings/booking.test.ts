import argon2 from "argon2";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const app = createApp();
const suffix = Date.now();
const password = "Sup3rSecret!";

const userAEmail = `test.booking.a.${suffix}@lumiere.test`;
const userBEmail = `test.booking.b.${suffix}@lumiere.test`;

let cookiesA: { access: string; csrf: string };
let cookiesB: { access: string; csrf: string };
let showtimeId: string;
let seatIds: string[];
let cinemaId: string;
let roomId: string;
let movieId: string;
let personId: string;
let genreId: string;
let productId: string;

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
  await prisma.user.createMany({
    data: [
      { email: userAEmail, passwordHash, firstName: "Usuario", lastName: "A" },
      { email: userBEmail, passwordHash, firstName: "Usuario", lastName: "B" },
    ],
  });

  cookiesA = await loginAs(userAEmail);
  cookiesB = await loginAs(userBEmail);

  const rating = await prisma.movieRating.findFirstOrThrow();
  const language = await prisma.language.findFirstOrThrow();
  const seatType = await prisma.seatType.findFirstOrThrow();

  const cinema = await prisma.cinema.create({
    data: { name: `Cine reservas ${suffix}`, address: "Av 1", city: "Ciudad", state: "Edo", country: "País" },
  });
  cinemaId = cinema.id;

  const room = await prisma.room.create({
    data: { cinemaId, name: "Sala reservas", roomType: "STANDARD", totalCapacity: 4 },
  });
  roomId = room.id;
  await prisma.seat.createMany({
    data: Array.from({ length: 4 }, (_, i) => ({
      roomId,
      rowLabel: "A",
      seatNumber: i + 1,
      seatTypeId: seatType.id,
    })),
  });

  const person = await prisma.person.create({ data: { firstName: "Dir", lastName: `Reservas${suffix}` } });
  personId = person.id;
  const genre = await prisma.genre.create({ data: { name: `Género reservas ${suffix}` } });
  genreId = genre.id;

  const movie = await prisma.movie.create({
    data: {
      title: `Película reservas ${suffix}`,
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

  const product = await prisma.product.create({
    data: { name: `Combo prueba ${suffix}`, price: 60 },
  });
  productId = product.id;

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

  const seats = await prisma.seat.findMany({ where: { roomId }, orderBy: { seatNumber: "asc" } });
  await prisma.showtimeSeat.createMany({
    data: seats.map((s) => ({ showtimeId, seatId: s.id, status: "AVAILABLE" as const })),
  });
  const showtimeSeats = await prisma.showtimeSeat.findMany({ where: { showtimeId }, orderBy: { seat: { seatNumber: "asc" } } });
  seatIds = showtimeSeats.map((s) => s.id);
});

afterAll(async () => {
  await prisma.orderSeat.deleteMany({ where: { showtimeSeat: { showtimeId } } });
  await prisma.orderItem.deleteMany({ where: { order: { showtimeId } } });
  await prisma.order.deleteMany({ where: { showtimeId } });
  await prisma.showtimeSeat.deleteMany({ where: { showtimeId } });
  await prisma.showtime.deleteMany({ where: { id: showtimeId } });
  await prisma.movie.deleteMany({ where: { id: movieId } });
  await prisma.person.deleteMany({ where: { id: personId } });
  await prisma.genre.deleteMany({ where: { id: genreId } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.cinema.deleteMany({ where: { id: cinemaId } });
  await prisma.user.deleteMany({ where: { email: { in: [userAEmail, userBEmail] } } });
  await prisma.$disconnect();
  await redis.quit().catch(() => undefined);
});

describe("Mapa de butacas", () => {
  it("es publico y refleja el estado real de cada butaca", async () => {
    const res = await request(app).get(`/api/v1/showtimes/${showtimeId}/seats`);
    expect(res.status).toBe(200);
    expect(res.body.seats).toHaveLength(4);
    expect(res.body.seats.every((s: { status: string }) => s.status === "AVAILABLE")).toBe(true);
  });

  it("404 en función inexistente", async () => {
    const res = await request(app).get("/api/v1/showtimes/00000000-0000-0000-0000-000000000000/seats");
    expect(res.status).toBe(404);
  });
});

describe("Bloqueo de butacas", () => {
  it("rechaza bloquear sin autenticación", async () => {
    const res = await request(app)
      .post(`/api/v1/showtimes/${showtimeId}/seats/lock`)
      .send({ seatIds: [seatIds[0]] });
    expect(res.status).toBe(401);
  });

  it("usuario A bloquea la butaca 1 exitosamente", async () => {
    const res = await withAuth(
      request(app).post(`/api/v1/showtimes/${showtimeId}/seats/lock`),
      cookiesA,
    ).send({ seatIds: [seatIds[0]] });

    expect(res.status).toBe(200);
    expect(res.body.seatIds).toEqual([seatIds[0]]);
    expect(res.body.lockExpiresAt).toBeDefined();
  });

  it("el mapa de butacas refleja el bloqueo inmediatamente", async () => {
    const res = await request(app).get(`/api/v1/showtimes/${showtimeId}/seats`);
    const lockedSeat = res.body.seats.find((s: { id: string }) => s.id === seatIds[0]);
    expect(lockedSeat.status).toBe("LOCKED");
  });

  it("usuario B no puede bloquear la misma butaca que ya bloqueó A", async () => {
    const res = await withAuth(
      request(app).post(`/api/v1/showtimes/${showtimeId}/seats/lock`),
      cookiesB,
    ).send({ seatIds: [seatIds[0]] });
    expect(res.status).toBe(409);
  });

  it("dos usuarios compitiendo por la misma butaca al mismo tiempo: solo uno gana", async () => {
    const contestedSeat = seatIds[1];

    const [resA, resB] = await Promise.all([
      withAuth(request(app).post(`/api/v1/showtimes/${showtimeId}/seats/lock`), cookiesA).send({
        seatIds: [contestedSeat],
      }),
      withAuth(request(app).post(`/api/v1/showtimes/${showtimeId}/seats/lock`), cookiesB).send({
        seatIds: [contestedSeat],
      }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    // limpiar: liberar la que gano, para no interferir con tests siguientes
    const winnerCookies = resA.status === 200 ? cookiesA : cookiesB;
    await withAuth(
      request(app).post(`/api/v1/showtimes/${showtimeId}/seats/release`),
      winnerCookies,
    ).send({ seatIds: [contestedSeat] });
  });

  it("usuario A libera la butaca 1 y usuario B ya puede bloquearla", async () => {
    const releaseRes = await withAuth(
      request(app).post(`/api/v1/showtimes/${showtimeId}/seats/release`),
      cookiesA,
    ).send({ seatIds: [seatIds[0]] });
    expect(releaseRes.status).toBe(200);

    const lockRes = await withAuth(
      request(app).post(`/api/v1/showtimes/${showtimeId}/seats/lock`),
      cookiesB,
    ).send({ seatIds: [seatIds[0]] });
    expect(lockRes.status).toBe(200);

    // liberar para el resto de la suite
    await withAuth(request(app).post(`/api/v1/showtimes/${showtimeId}/seats/release`), cookiesB).send({
      seatIds: [seatIds[0]],
    });
  });
});

describe("Órdenes", () => {
  let orderId: string;

  it("rechaza crear orden sin haber bloqueado las butacas primero", async () => {
    const res = await withAuth(request(app).post("/api/v1/orders"), cookiesA).send({
      showtimeId,
      seatIds: [seatIds[2]],
    });
    expect(res.status).toBe(409);
  });

  it("crea una orden con butacas bloqueadas y un combo, con el subtotal correcto", async () => {
    const lockRes = await withAuth(
      request(app).post(`/api/v1/showtimes/${showtimeId}/seats/lock`),
      cookiesA,
    ).send({ seatIds: [seatIds[2], seatIds[3]] });
    expect(lockRes.status).toBe(200);

    const orderRes = await withAuth(request(app).post("/api/v1/orders"), cookiesA).send({
      showtimeId,
      seatIds: [seatIds[2], seatIds[3]],
      items: [{ productId, quantity: 2 }],
    });

    expect(orderRes.status).toBe(201);
    // 2 butacas standard * 100 (basePrice * multiplier 1) + 2 combos * 60 = 320
    expect(Number(orderRes.body.order.totalAmount)).toBe(320);
    expect(orderRes.body.order.status).toBe("PENDING");
    orderId = orderRes.body.order.id;
  });

  it("otro usuario no puede ver la orden de otro (403)", async () => {
    const res = await withAuth(request(app).get(`/api/v1/orders/${orderId}`), cookiesB);
    expect(res.status).toBe(403);
  });

  it("el dueño sí puede ver su orden", async () => {
    const res = await withAuth(request(app).get(`/api/v1/orders/${orderId}`), cookiesA);
    expect(res.status).toBe(200);
    expect(res.body.order.seats).toHaveLength(2);
  });

  it("aparece en el listado /orders/me del dueño", async () => {
    const res = await withAuth(request(app).get("/api/v1/orders/me"), cookiesA);
    expect(res.status).toBe(200);
    expect(res.body.items.some((o: { id: string }) => o.id === orderId)).toBe(true);
  });

  it("cancelar la orden libera las butacas", async () => {
    const cancelRes = await withAuth(request(app).post(`/api/v1/orders/${orderId}/cancel`), cookiesA);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.order.status).toBe("CANCELLED");

    const lockRes = await withAuth(
      request(app).post(`/api/v1/showtimes/${showtimeId}/seats/lock`),
      cookiesB,
    ).send({ seatIds: [seatIds[2]] });
    expect(lockRes.status).toBe(200);

    await withAuth(request(app).post(`/api/v1/showtimes/${showtimeId}/seats/release`), cookiesB).send({
      seatIds: [seatIds[2]],
    });
  });
});
