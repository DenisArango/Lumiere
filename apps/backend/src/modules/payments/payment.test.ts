import argon2 from "argon2";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { paymentGateways } from "@/modules/payments/payment-gateway.registry";
import type { PaymentGateway } from "@/modules/payments/payment-gateway";

const app = createApp();
const suffix = Date.now();
const password = "Sup3rSecret!";

const buyerEmail = `test.payment.buyer.${suffix}@lumiere.test`;
const otherEmail = `test.payment.other.${suffix}@lumiere.test`;

let buyerCookies: { access: string; csrf: string };
let otherCookies: { access: string; csrf: string };
let cinemaId: string;
let roomId: string;
let movieId: string;
let personId: string;
let genreId: string;
let showtimeId: string;
let seatIds: string[];

/** Gateway simulado: nunca toca la red. Se instala en el registro real
 * (paymentGateways.STRIPE) antes de ejercitar la app real via supertest,
 * para probar la maquina de estados de la orden de punta a punta - ver
 * docs/backend/09-pagos.md. */
class MockGateway implements PaymentGateway {
  public shouldSucceed = true;
  public chargeCalls: unknown[] = [];
  public refundCalls: unknown[] = [];

  async charge(params: { amount: number; currency: string; source: string }) {
    this.chargeCalls.push(params);
    return {
      providerPaymentId: `mock_charge_${this.chargeCalls.length}_${suffix}`,
      status: this.shouldSucceed ? ("COMPLETED" as const) : ("FAILED" as const),
    };
  }

  async refund(providerPaymentId: string, amount: number) {
    this.refundCalls.push({ providerPaymentId, amount });
    return {
      providerRefundId: `mock_refund_${this.refundCalls.length}_${suffix}`,
      status: this.shouldSucceed ? ("COMPLETED" as const) : ("FAILED" as const),
    };
  }
}

const mockGateway = new MockGateway();

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
  paymentGateways.STRIPE = mockGateway;

  const passwordHash = await argon2.hash(password);
  await prisma.user.create({
    data: { email: buyerEmail, passwordHash, firstName: "Compradora", lastName: "Pago" },
  });
  await prisma.user.create({
    data: { email: otherEmail, passwordHash, firstName: "Otra", lastName: "Persona" },
  });
  buyerCookies = await loginAs(buyerEmail);
  otherCookies = await loginAs(otherEmail);

  const rating = await prisma.movieRating.findFirstOrThrow();
  const language = await prisma.language.findFirstOrThrow();
  const seatType = await prisma.seatType.findFirstOrThrow();

  const cinema = await prisma.cinema.create({
    data: { name: `Cine pagos ${suffix}`, address: "Av 1", city: "Ciudad", state: "Edo", country: "País" },
  });
  cinemaId = cinema.id;
  const room = await prisma.room.create({
    data: { cinemaId, name: "Sala pagos", roomType: "STANDARD", totalCapacity: 2 },
  });
  roomId = room.id;
  const seats = await Promise.all(
    [1, 2].map((n) =>
      prisma.seat.create({ data: { roomId, rowLabel: "A", seatNumber: n, seatTypeId: seatType.id } }),
    ),
  );

  const person = await prisma.person.create({ data: { firstName: "Dir", lastName: `Pagos${suffix}` } });
  personId = person.id;
  const genre = await prisma.genre.create({ data: { name: `Género pagos ${suffix}` } });
  genreId = genre.id;

  const movie = await prisma.movie.create({
    data: {
      title: `Película pagos ${suffix}`,
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
      basePrice: 120,
      format: "TWO_D",
    },
  });
  showtimeId = showtime.id;

  const showtimeSeats = await prisma.showtimeSeat.createManyAndReturn({
    data: seats.map((s) => ({ showtimeId, seatId: s.id, status: "AVAILABLE" as const })),
  });
  seatIds = showtimeSeats.map((s) => s.id);
});

afterAll(async () => {
  await prisma.orderSeat.deleteMany({ where: { showtimeSeat: { showtimeId } } });
  await prisma.payment.deleteMany({ where: { order: { showtimeId } } });
  await prisma.order.deleteMany({ where: { showtimeId } });
  await prisma.showtimeSeat.deleteMany({ where: { showtimeId } });
  await prisma.showtime.deleteMany({ where: { id: showtimeId } });
  await prisma.movie.deleteMany({ where: { id: movieId } });
  await prisma.person.deleteMany({ where: { id: personId } });
  await prisma.genre.deleteMany({ where: { id: genreId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.cinema.deleteMany({ where: { id: cinemaId } });
  await prisma.user.deleteMany({ where: { email: { in: [buyerEmail, otherEmail] } } });
  await prisma.$disconnect();
  await redis.quit().catch(() => undefined);
});

describe("Pagos", () => {
  let orderId: string;

  it("prepara: bloquea butaca y crea orden pendiente", async () => {
    const lockRes = await withAuth(
      request(app).post(`/api/v1/showtimes/${showtimeId}/seats/lock`),
      buyerCookies,
    ).send({ seatIds: [seatIds[0]] });
    expect(lockRes.status).toBe(200);

    const orderRes = await withAuth(request(app).post("/api/v1/orders"), buyerCookies).send({
      showtimeId,
      seatIds: [seatIds[0]],
    });
    expect(orderRes.status).toBe(201);
    orderId = orderRes.body.order.id;
  });

  it("otra persona no puede pagar la orden ajena", async () => {
    const res = await withAuth(request(app).post(`/api/v1/orders/${orderId}/pay`), otherCookies).send({
      provider: "STRIPE",
      source: "pm_mock_token",
    });
    expect(res.status).toBe(403);
  });

  it("el gateway rechaza el cobro: la orden permanece PENDING y la butaca sigue LOCKED", async () => {
    mockGateway.shouldSucceed = false;

    const res = await withAuth(request(app).post(`/api/v1/orders/${orderId}/pay`), buyerCookies).send({
      provider: "STRIPE",
      source: "pm_mock_token_fail",
    });
    expect(res.status).toBe(402);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("PENDING");

    const seat = await prisma.showtimeSeat.findUniqueOrThrow({ where: { id: seatIds[0] } });
    expect(seat.status).toBe("LOCKED");

    const failedPayment = await prisma.payment.findFirst({ where: { orderId } });
    expect(failedPayment?.status).toBe("FAILED");

    mockGateway.shouldSucceed = true;
  });

  it("el cobro exitoso marca la orden PAID, la butaca SOLD, genera QR y libera el lock de Redis", async () => {
    const res = await withAuth(request(app).post(`/api/v1/orders/${orderId}/pay`), buyerCookies).send({
      provider: "STRIPE",
      source: "pm_mock_token_ok",
    });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("PAID");
    expect(res.body.order.qrCode).toMatch(/^LMR-[A-F0-9]+$/);

    const seat = await prisma.showtimeSeat.findUniqueOrThrow({ where: { id: seatIds[0] } });
    expect(seat.status).toBe("SOLD");
    expect(seat.lockedByUserId).toBeNull();

    const redisLockKey = `seatlock:${seatIds[0]}`;
    const lockValue = await redis.get(redisLockKey);
    expect(lockValue).toBeNull();

    const payment = await prisma.payment.findFirst({ where: { orderId, status: "COMPLETED" } });
    expect(payment).not.toBeNull();
  });

  it("rechaza pagar una orden que ya está PAID", async () => {
    const res = await withAuth(request(app).post(`/api/v1/orders/${orderId}/pay`), buyerCookies).send({
      provider: "STRIPE",
      source: "pm_mock_token_again",
    });
    expect(res.status).toBe(409);
  });

  it("otra persona no puede reembolsar la orden ajena", async () => {
    const res = await withAuth(request(app).post(`/api/v1/orders/${orderId}/refund`), otherCookies);
    expect(res.status).toBe(403);
  });

  it("reembolsar libera la butaca de vuelta a AVAILABLE", async () => {
    const res = await withAuth(request(app).post(`/api/v1/orders/${orderId}/refund`), buyerCookies);
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("REFUNDED");

    const seat = await prisma.showtimeSeat.findUniqueOrThrow({ where: { id: seatIds[0] } });
    expect(seat.status).toBe("AVAILABLE");

    const anotherLock = await withAuth(
      request(app).post(`/api/v1/showtimes/${showtimeId}/seats/lock`),
      otherCookies,
    ).send({ seatIds: [seatIds[0]] });
    expect(anotherLock.status).toBe(200);

    await withAuth(request(app).post(`/api/v1/showtimes/${showtimeId}/seats/release`), otherCookies).send({
      seatIds: [seatIds[0]],
    });
  });

  it("rechaza reembolsar una orden que no está PAID", async () => {
    const res = await withAuth(request(app).post(`/api/v1/orders/${orderId}/refund`), buyerCookies);
    expect(res.status).toBe(409);
  });
});
