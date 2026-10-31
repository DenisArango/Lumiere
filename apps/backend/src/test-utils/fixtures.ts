import argon2 from "argon2";
import request from "supertest";
import type { Express } from "express";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  ChargeParams,
  ChargeResult,
  CheckoutSession,
  CheckoutSessionParams,
  ConfirmParams,
  PaymentGateway,
  RefundResult,
} from "@/modules/payments/payment-gateway";

export const TEST_PASSWORD = "Sup3rSecret!";

export interface Cookies {
  access: string;
  csrf: string;
}

function extractCookie(cookies: string | string[] | undefined, name: string): string {
  const arr = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
  const raw = arr.find((c) => c.startsWith(`${name}=`));
  const value = raw?.split(";")[0]?.split("=")[1];
  if (!value) throw new Error(`Cookie ${name} no encontrada`);
  return value;
}

export async function loginAs(app: Express, email: string): Promise<Cookies> {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password: TEST_PASSWORD });
  const cookies = res.get("set-cookie");
  return { access: extractCookie(cookies, "access_token"), csrf: extractCookie(cookies, "csrf_token") };
}

export function withAuth(req: request.Test, c: Cookies): request.Test {
  return req.set("Cookie", [`access_token=${c.access}`, `csrf_token=${c.csrf}`]).set("x-csrf-token", c.csrf);
}

export async function createTestUser(
  email: string,
  role: Role = "CUSTOMER",
  extra: { loyaltyMember?: boolean; loyaltyPoints?: number } = {},
) {
  return prisma.user.create({
    data: {
      email,
      passwordHash: await argon2.hash(TEST_PASSWORD),
      firstName: "Prueba",
      lastName: role,
      role,
      ...extra,
    },
  });
}

export interface ShowtimeFixture {
  showtimeId: string;
  seatIds: string[];
  cleanup: () => Promise<void>;
}

/** Cine + sala + butacas + pelicula + funcion futura. `cleanup` borra todo lo que cuelga de la funcion. */
export async function createShowtimeFixture(suffix: number | string, seatCount: number, basePrice: number): Promise<ShowtimeFixture> {
  const rating = await prisma.movieRating.findFirstOrThrow();
  const language = await prisma.language.findFirstOrThrow();
  const seatType = await prisma.seatType.findFirstOrThrow();

  const cinema = await prisma.cinema.create({
    data: { name: `Cine test ${suffix}`, address: "Av 1", city: "Ciudad", state: "Edo", country: "País" },
  });
  const room = await prisma.room.create({
    data: { cinemaId: cinema.id, name: "Sala test", roomType: "STANDARD", totalCapacity: seatCount },
  });
  const seats = [];
  for (let n = 1; n <= seatCount; n += 1) {
    seats.push(await prisma.seat.create({ data: { roomId: room.id, rowLabel: "A", seatNumber: n, seatTypeId: seatType.id } }));
  }

  const person = await prisma.person.create({ data: { firstName: "Dir", lastName: `Test${suffix}` } });
  const genre = await prisma.genre.create({ data: { name: `Género test ${suffix}` } });
  const movie = await prisma.movie.create({
    data: {
      title: `Película test ${suffix}`,
      synopsis: "Sinopsis",
      durationMinutes: 90,
      releaseYear: 2026,
      countryOfOrigin: "México",
      ratingId: rating.id,
      originalLanguageId: language.id,
      genres: { create: [{ genreId: genre.id }] },
      credits: { create: [{ personId: person.id, creditRole: "DIRECTOR" }] },
    },
  });

  const start = Date.now() + 24 * 60 * 60 * 1000;
  const showtime = await prisma.showtime.create({
    data: {
      movieId: movie.id,
      roomId: room.id,
      audioLanguageId: language.id,
      startTime: new Date(start),
      endTime: new Date(start + 110 * 60 * 1000),
      basePrice,
      format: "TWO_D",
    },
  });
  const showtimeSeats = await prisma.showtimeSeat.createManyAndReturn({
    data: seats.map((s) => ({ showtimeId: showtime.id, seatId: s.id, status: "AVAILABLE" as const })),
  });

  return {
    showtimeId: showtime.id,
    seatIds: showtimeSeats.map((s) => s.id),
    cleanup: async () => {
      await prisma.auditLog.deleteMany({ where: { entityId: showtime.id } });
      await prisma.orderSeat.deleteMany({ where: { showtimeSeat: { showtimeId: showtime.id } } });
      await prisma.payment.deleteMany({ where: { order: { showtimeId: showtime.id } } });
      await prisma.order.deleteMany({ where: { showtimeId: showtime.id } });
      await prisma.showtimeSeat.deleteMany({ where: { showtimeId: showtime.id } });
      await prisma.showtime.deleteMany({ where: { id: showtime.id } });
      await prisma.movie.deleteMany({ where: { id: movie.id } });
      await prisma.person.deleteMany({ where: { id: person.id } });
      await prisma.genre.deleteMany({ where: { id: genre.id } });
      await prisma.room.deleteMany({ where: { id: room.id } });
      await prisma.cinema.deleteMany({ where: { id: cinema.id } });
    },
  };
}

/** Pasarela guionada: cada prueba decide que responde el "proveedor", sin red ni credenciales. */
export class ScriptedGateway implements PaymentGateway {
  public chargeResult: Omit<ChargeResult, "providerPaymentId"> = { status: "COMPLETED" };
  public confirmStatus: ChargeResult["status"] = "COMPLETED";
  public failRefundFor = new Set<string>();
  public refundCalls: { providerPaymentId: string; amount: number }[] = [];
  private counter = 0;

  constructor(private readonly prefix: string) {}

  async charge(params: ChargeParams): Promise<ChargeResult> {
    this.counter += 1;
    return { providerPaymentId: `${this.prefix}_${this.counter}_${params.orderId.slice(0, 8)}`, ...this.chargeResult };
  }

  async confirm(params: ConfirmParams): Promise<ChargeResult> {
    return { providerPaymentId: params.providerPaymentId, status: this.confirmStatus };
  }

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSession> {
    return { providerOrderId: `${this.prefix}_order_${params.orderId.slice(0, 8)}`, chargedAmount: params.amount, chargedCurrency: params.currency };
  }

  async refund(providerPaymentId: string, amount: number): Promise<RefundResult> {
    this.refundCalls.push({ providerPaymentId, amount });
    const ok = !this.failRefundFor.has(providerPaymentId);
    return { providerRefundId: `refund_${providerPaymentId}`, status: ok ? "COMPLETED" : "FAILED" };
  }
}

/** Compra completa por la API: bloquea, crea la orden y (opcionalmente) la paga. Devuelve el id de la orden. */
export async function placeOrder(
  app: Express,
  cookies: Cookies,
  showtimeId: string,
  seatId: string,
  extra: { redeemPoints?: number } = {},
): Promise<request.Response> {
  const lock = await withAuth(request(app).post(`/api/v1/showtimes/${showtimeId}/seats/lock`), cookies).send({ seatIds: [seatId] });
  if (lock.status !== 200) throw new Error(`lock falló: ${lock.status} ${JSON.stringify(lock.body)}`);
  return withAuth(request(app).post("/api/v1/orders"), cookies).send({ showtimeId, seatIds: [seatId], ...extra });
}
