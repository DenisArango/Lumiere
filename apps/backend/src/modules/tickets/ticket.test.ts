import argon2 from "argon2";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const app = createApp();
const suffix = Date.now();
const password = "Sup3rSecret!";

const boxOfficeEmail = `test.tickets.boxoffice.${suffix}@lumiere.test`;
const customerEmail = `test.tickets.customer.${suffix}@lumiere.test`;
const buyerEmail = `test.tickets.buyer.${suffix}@lumiere.test`;

let boxOfficeCookies: { access: string; csrf: string };
let customerCookies: { access: string; csrf: string };
let cinemaId: string;
let roomId: string;
let movieId: string;
let personId: string;
let genreId: string;
let showtimeId: string;
let paidOrderId: string;
let pendingOrderId: string;
const paidQrCode = `LMR-TICKETSMOKE${suffix}`;
const pendingQrCode = `LMR-PENDINGSMOKE${suffix}`;

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
    data: { email: boxOfficeEmail, passwordHash, firstName: "Taquilla", lastName: "T", role: "BOX_OFFICE" },
  });
  await prisma.user.create({
    data: { email: customerEmail, passwordHash, firstName: "Cliente", lastName: "T" },
  });
  const buyer = await prisma.user.create({
    data: { email: buyerEmail, passwordHash, firstName: "Compradora", lastName: "T" },
  });

  boxOfficeCookies = await loginAs(boxOfficeEmail);
  customerCookies = await loginAs(customerEmail);

  const rating = await prisma.movieRating.findFirstOrThrow();
  const language = await prisma.language.findFirstOrThrow();
  const seatType = await prisma.seatType.findFirstOrThrow();

  const cinema = await prisma.cinema.create({
    data: { name: `Cine tickets ${suffix}`, address: "Av 1", city: "Ciudad", state: "Edo", country: "País" },
  });
  cinemaId = cinema.id;
  const room = await prisma.room.create({
    data: { cinemaId, name: "Sala tickets", roomType: "STANDARD", totalCapacity: 2 },
  });
  roomId = room.id;
  const seats = await prisma.seat.createManyAndReturn({
    data: [1, 2].map((n) => ({ roomId, rowLabel: "A", seatNumber: n, seatTypeId: seatType.id })),
  });

  const person = await prisma.person.create({ data: { firstName: "Dir", lastName: `Tickets${suffix}` } });
  personId = person.id;
  const genre = await prisma.genre.create({ data: { name: `Género tickets ${suffix}` } });
  genreId = genre.id;

  const movie = await prisma.movie.create({
    data: {
      title: `Película tickets ${suffix}`,
      synopsis: "x",
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
      startTime: new Date(Date.now() + 86_400_000),
      endTime: new Date(Date.now() + 86_400_000 + 7_200_000),
      basePrice: 100,
      format: "TWO_D",
    },
  });
  showtimeId = showtime.id;

  const showtimeSeats = await prisma.showtimeSeat.createManyAndReturn({
    data: seats.map((s) => ({ showtimeId, seatId: s.id, status: "SOLD" as const })),
  });

  const paidOrder = await prisma.order.create({
    data: {
      userId: buyer.id,
      showtimeId,
      status: "PAID",
      subtotal: 100,
      discountAmount: 0,
      totalAmount: 100,
      qrCode: paidQrCode,
      seats: { create: [{ showtimeSeatId: showtimeSeats[0]!.id, priceAtPurchase: 100 }] },
    },
  });
  paidOrderId = paidOrder.id;

  const pendingOrder = await prisma.order.create({
    data: {
      userId: buyer.id,
      showtimeId,
      status: "PENDING",
      subtotal: 100,
      discountAmount: 0,
      totalAmount: 100,
      qrCode: pendingQrCode,
      seats: { create: [{ showtimeSeatId: showtimeSeats[1]!.id, priceAtPurchase: 100 }] },
    },
  });
  pendingOrderId = pendingOrder.id;
});

afterAll(async () => {
  await prisma.orderSeat.deleteMany({ where: { orderId: { in: [paidOrderId, pendingOrderId] } } });
  await prisma.order.deleteMany({ where: { id: { in: [paidOrderId, pendingOrderId] } } });
  await prisma.showtimeSeat.deleteMany({ where: { showtimeId } });
  await prisma.showtime.deleteMany({ where: { id: showtimeId } });
  await prisma.movieCredit.deleteMany({ where: { movieId } });
  await prisma.movieGenre.deleteMany({ where: { movieId } });
  await prisma.movie.deleteMany({ where: { id: movieId } });
  await prisma.person.deleteMany({ where: { id: personId } });
  await prisma.genre.deleteMany({ where: { id: genreId } });
  await prisma.seat.deleteMany({ where: { roomId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.cinema.deleteMany({ where: { id: cinemaId } });
  await prisma.user.deleteMany({ where: { email: { in: [boxOfficeEmail, customerEmail, buyerEmail] } } });
  await prisma.$disconnect();
  await redis.quit().catch(() => undefined);
});

describe("Validación de boletos (taquilla)", () => {
  it("rechaza sin autenticación", async () => {
    const res = await request(app).post("/api/v1/tickets/validate").send({ qrCode: paidQrCode });
    expect(res.status).toBe(401);
  });

  it("rechaza a un CUSTOMER (solo taquilla/staff)", async () => {
    const res = await withAuth(request(app).post("/api/v1/tickets/validate"), customerCookies).send({
      qrCode: paidQrCode,
    });
    expect(res.status).toBe(403);
  });

  it("rechaza un código inexistente", async () => {
    const res = await withAuth(request(app).post("/api/v1/tickets/validate"), boxOfficeCookies).send({
      qrCode: "LMR-NOEXISTE",
    });
    expect(res.status).toBe(404);
  });

  it("rechaza una orden que no está pagada", async () => {
    const res = await withAuth(request(app).post("/api/v1/tickets/validate"), boxOfficeCookies).send({
      qrCode: pendingQrCode,
    });
    expect(res.status).toBe(409);
  });

  it("BOX_OFFICE valida un boleto pagado exitosamente", async () => {
    const res = await withAuth(request(app).post("/api/v1/tickets/validate"), boxOfficeCookies).send({
      qrCode: paidQrCode,
    });
    expect(res.status).toBe(200);
    expect(res.body.order.checkedInAt).not.toBeNull();
    expect(res.body.order.showtime.movie.title).toContain("tickets");
  });

  it("rechaza reutilizar el mismo boleto ya validado", async () => {
    const res = await withAuth(request(app).post("/api/v1/tickets/validate"), boxOfficeCookies).send({
      qrCode: paidQrCode,
    });
    expect(res.status).toBe(409);
  });
});
