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

const adminEmail = `test.users.admin.${suffix}@lumiere.test`;
const customerEmail = `test.users.customer.${suffix}@lumiere.test`;
const staffEmail = `test.users.staff.${suffix}@lumiere.test`;

type Cookies = { access: string; csrf: string };

let adminCookies: Cookies;
let customerCookies: Cookies;
let adminId: string;
let customerId: string;
let cinemaId: string;
let roomId: string;
let movieId: string;
let personId: string;
let genreId: string;
let showtimeId: string;
let seatIds: string[];

class MockGateway implements PaymentGateway {
  private calls = 0;

  async charge() {
    this.calls += 1;
    return { providerPaymentId: `mock_charge_${suffix}_${this.calls}`, status: "COMPLETED" as const };
  }
  async refund() {
    return { providerRefundId: `mock_refund_${suffix}`, status: "COMPLETED" as const };
  }
}

function extractCookie(cookies: string | string[] | undefined, name: string): string {
  const arr = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
  const raw = arr.find((c) => c.startsWith(`${name}=`));
  const value = raw?.split(";")[0]?.split("=")[1];
  if (!value) throw new Error(`Cookie ${name} no encontrada`);
  return value;
}

async function loginAs(email: string): Promise<Cookies> {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password });
  const cookies = res.get("set-cookie");
  return { access: extractCookie(cookies, "access_token"), csrf: extractCookie(cookies, "csrf_token") };
}

function withAuth(req: request.Test, c: Cookies): request.Test {
  return req
    .set("Cookie", [`access_token=${c.access}`, `csrf_token=${c.csrf}`])
    .set("x-csrf-token", c.csrf);
}

beforeAll(async () => {
  paymentGateways.STRIPE = new MockGateway();

  const passwordHash = await argon2.hash(password);
  const admin = await prisma.user.create({
    data: { email: adminEmail, passwordHash, firstName: "Admin", lastName: "Usuarios", role: "SUPER_ADMIN" },
  });
  const customer = await prisma.user.create({
    data: { email: customerEmail, passwordHash, firstName: "Cliente", lastName: "Puntos" },
  });
  adminId = admin.id;
  customerId = customer.id;
  adminCookies = await loginAs(adminEmail);
  customerCookies = await loginAs(customerEmail);

  const rating = await prisma.movieRating.findFirstOrThrow();
  const language = await prisma.language.findFirstOrThrow();
  const seatType = await prisma.seatType.findFirstOrThrow();

  const cinema = await prisma.cinema.create({
    data: { name: `Cine usuarios ${suffix}`, address: "Av 1", city: "Ciudad", state: "Edo", country: "País" },
  });
  cinemaId = cinema.id;
  const room = await prisma.room.create({
    data: { cinemaId, name: "Sala usuarios", roomType: "STANDARD", totalCapacity: 2 },
  });
  roomId = room.id;
  const seats = await Promise.all(
    [1, 2].map((n) =>
      prisma.seat.create({ data: { roomId, rowLabel: "A", seatNumber: n, seatTypeId: seatType.id } }),
    ),
  );

  const person = await prisma.person.create({ data: { firstName: "Dir", lastName: `Usuarios${suffix}` } });
  personId = person.id;
  const genre = await prisma.genre.create({ data: { name: `Género usuarios ${suffix}` } });
  genreId = genre.id;

  const movie = await prisma.movie.create({
    data: {
      title: `Película usuarios ${suffix}`,
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
      basePrice: 120.5,
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
  await prisma.user.deleteMany({ where: { email: { in: [adminEmail, customerEmail, staffEmail] } } });
  await prisma.$disconnect();
  await redis.quit().catch(() => undefined);
});

describe("Gestión de usuarios (SUPER_ADMIN)", () => {
  let staffId: string;

  it("rechaza sin sesión (401) y a un cliente (403)", async () => {
    expect((await request(app).get("/api/v1/users")).status).toBe(401);
    expect((await withAuth(request(app).get("/api/v1/users"), customerCookies)).status).toBe(403);
  });

  it("lista usuarios paginados y filtra por rol, sin exponer el hash de contraseña", async () => {
    const res = await withAuth(request(app).get("/api/v1/users?role=SUPER_ADMIN&pageSize=50"), adminCookies);
    expect(res.status).toBe(200);
    expect(res.body.items.some((u: { id: string }) => u.id === adminId)).toBe(true);
    expect(res.body.items.every((u: { role: string }) => u.role === "SUPER_ADMIN")).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("crea una cuenta de taquilla y esa persona puede iniciar sesión", async () => {
    const res = await withAuth(request(app).post("/api/v1/users"), adminCookies).send({
      email: staffEmail,
      password,
      firstName: "Taquilla",
      lastName: "Nueva",
      role: "BOX_OFFICE",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("BOX_OFFICE");
    expect(res.body.user.passwordHash).toBeUndefined();
    staffId = res.body.user.id;

    const login = await request(app).post("/api/v1/auth/login").send({ email: staffEmail, password });
    expect(login.status).toBe(200);
  });

  it("rechaza un email repetido (409) y una contraseña débil (422)", async () => {
    const dup = await withAuth(request(app).post("/api/v1/users"), adminCookies).send({
      email: staffEmail,
      password,
      firstName: "X",
      lastName: "Y",
      role: "BOX_OFFICE",
    });
    expect(dup.status).toBe(409);

    const weak = await withAuth(request(app).post("/api/v1/users"), adminCookies).send({
      email: `weak.${suffix}@lumiere.test`,
      password: "abc",
      firstName: "X",
      lastName: "Y",
      role: "BOX_OFFICE",
    });
    expect(weak.status).toBe(422);
  });

  it("no permite quitarse el propio rol ni desactivarse", async () => {
    const demote = await withAuth(request(app).patch(`/api/v1/users/${adminId}`), adminCookies).send({
      role: "CUSTOMER",
    });
    expect(demote.status).toBe(403);

    const deactivate = await withAuth(request(app).patch(`/api/v1/users/${adminId}`), adminCookies).send({
      isActive: false,
    });
    expect(deactivate.status).toBe(403);
  });

  it("desactivar una cuenta revoca sus sesiones y bloquea el login", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ email: staffEmail, password });
    const refreshToken = extractCookie(login.get("set-cookie"), "refresh_token");

    const res = await withAuth(request(app).patch(`/api/v1/users/${staffId}`), adminCookies).send({
      isActive: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.user.isActive).toBe(false);

    const active = await prisma.refreshToken.count({ where: { userId: staffId, revokedAt: null } });
    expect(active).toBe(0);
    expect(refreshToken).toBeTruthy();

    const blocked = await request(app).post("/api/v1/auth/login").send({ email: staffEmail, password });
    expect(blocked.status).toBe(401);
  });

  it("devuelve 404 al editar un usuario inexistente", async () => {
    const res = await withAuth(
      request(app).patch("/api/v1/users/00000000-0000-4000-8000-000000000000"),
      adminCookies,
    ).send({ firstName: "Nadie" });
    expect(res.status).toBe(404);
  });
});

describe("Programa de puntos", () => {
  let orderId: string;

  async function buy(seatId: string, cookies: Cookies): Promise<string> {
    const lock = await withAuth(request(app).post(`/api/v1/showtimes/${showtimeId}/seats/lock`), cookies).send({
      seatIds: [seatId],
    });
    expect(lock.status).toBe(200);
    const order = await withAuth(request(app).post("/api/v1/orders"), cookies).send({
      showtimeId,
      seatIds: [seatId],
    });
    expect(order.status).toBe(201);
    return order.body.order.id as string;
  }

  it("un cliente que no es miembro no suma puntos al pagar", async () => {
    const id = await buy(seatIds[1] as string, customerCookies);
    const pay = await withAuth(request(app).post(`/api/v1/orders/${id}/pay`), customerCookies).send({
      provider: "STRIPE",
      source: "pm_mock",
    });
    expect(pay.status).toBe(200);
    expect(pay.body.order.pointsEarned).toBe(0);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: customerId } });
    expect(user.loyaltyPoints).toBe(0);

    const refund = await withAuth(request(app).post(`/api/v1/orders/${id}/refund`), customerCookies);
    expect(refund.status).toBe(200);
  });

  it("inscribirse al programa marca la cuenta como miembro", async () => {
    expect((await request(app).post("/api/v1/users/me/loyalty")).status).toBe(401);

    const res = await withAuth(request(app).post("/api/v1/users/me/loyalty"), customerCookies);
    expect(res.status).toBe(200);
    expect(res.body.user.loyaltyMember).toBe(true);
  });

  it("un miembro suma 1 punto por unidad entera pagada (120.50 → 120)", async () => {
    orderId = await buy(seatIds[0] as string, customerCookies);
    const pay = await withAuth(request(app).post(`/api/v1/orders/${orderId}/pay`), customerCookies).send({
      provider: "STRIPE",
      source: "pm_mock",
    });
    expect(pay.status).toBe(200);
    expect(pay.body.order.pointsEarned).toBe(120);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: customerId } });
    expect(user.loyaltyPoints).toBe(120);
  });

  it("reembolsar revierte exactamente los puntos otorgados", async () => {
    const res = await withAuth(request(app).post(`/api/v1/orders/${orderId}/refund`), customerCookies);
    expect(res.status).toBe(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: customerId } });
    expect(user.loyaltyPoints).toBe(0);
  });
});

describe("Listados de staff para el panel", () => {
  it("GET /orders solo para SUPER_ADMIN/CINEMA_MANAGER, con comprador y película", async () => {
    expect((await withAuth(request(app).get("/api/v1/orders"), customerCookies)).status).toBe(403);

    const res = await withAuth(request(app).get("/api/v1/orders?status=REFUNDED&pageSize=50"), adminCookies);
    expect(res.status).toBe(200);
    const mine = res.body.items.find((o: { showtimeId: string }) => o.showtimeId === showtimeId);
    expect(mine.user.email).toBe(customerEmail);
    expect(mine.showtime.movie.title).toContain("Película usuarios");
  });

  it("GET /reviews solo para staff y filtra por aprobadas", async () => {
    expect((await withAuth(request(app).get("/api/v1/reviews"), customerCookies)).status).toBe(403);

    const hidden = await prisma.review.create({
      data: { userId: customerId, movieId, rating: 2, comment: "Oculta", isApproved: false },
    });

    const res = await withAuth(request(app).get("/api/v1/reviews?isApproved=false&pageSize=50"), adminCookies);
    expect(res.status).toBe(200);
    const found = res.body.items.find((r: { id: string }) => r.id === hidden.id);
    expect(found.movie.id).toBe(movieId);

    await prisma.review.delete({ where: { id: hidden.id } });
  });

  it("?includeInactive=true exige staff; sin el parámetro el listado sigue siendo público", async () => {
    const product = await prisma.product.create({
      data: { name: `Combo oculto ${suffix}`, price: 50, isActive: false },
    });

    expect((await request(app).get("/api/v1/products")).status).toBe(200);
    expect((await request(app).get("/api/v1/products?includeInactive=true")).status).toBe(401);
    expect((await withAuth(request(app).get("/api/v1/products?includeInactive=true"), customerCookies)).status).toBe(
      403,
    );

    const publicList = await request(app).get("/api/v1/products");
    expect(publicList.body.products.some((p: { id: string }) => p.id === product.id)).toBe(false);

    const adminList = await withAuth(request(app).get("/api/v1/products?includeInactive=true"), adminCookies);
    expect(adminList.status).toBe(200);
    expect(adminList.body.products.some((p: { id: string }) => p.id === product.id)).toBe(true);

    await prisma.product.delete({ where: { id: product.id } });
  });
});

describe("Butacas liberadas", () => {
  it("una butaca reembolsada o cancelada se puede volver a comprar (regresión: order_seats único)", async () => {
    const lockAndOrder = async (seatId: string): Promise<string> => {
      const lock = await withAuth(request(app).post(`/api/v1/showtimes/${showtimeId}/seats/lock`), customerCookies).send({
        seatIds: [seatId],
      });
      expect(lock.status).toBe(200);
      const order = await withAuth(request(app).post("/api/v1/orders"), customerCookies).send({
        showtimeId,
        seatIds: [seatId],
      });
      expect(order.status).toBe(201);
      return order.body.order.id as string;
    };
    const seatId = seatIds[0] as string;

    // 1) cancelar una orden pendiente y volver a comprar la misma butaca
    const first = await lockAndOrder(seatId);
    const cancel = await withAuth(request(app).post(`/api/v1/orders/${first}/cancel`), customerCookies);
    expect(cancel.status).toBe(200);
    expect(await prisma.orderSeat.count({ where: { orderId: first } })).toBe(0);

    // 2) pagar, reembolsar y volver a comprar otra vez
    const second = await lockAndOrder(seatId);
    const pay = await withAuth(request(app).post(`/api/v1/orders/${second}/pay`), customerCookies).send({
      provider: "STRIPE",
      source: "pm_mock",
    });
    expect(pay.status).toBe(200);
    const refund = await withAuth(request(app).post(`/api/v1/orders/${second}/refund`), customerCookies);
    expect(refund.status).toBe(200);

    const third = await lockAndOrder(seatId);
    expect(third).not.toBe(second);
  });

  it("un bloqueo vencido suelta la butaca y marca su orden pendiente como EXPIRED", async () => {
    const seatId = seatIds[1] as string;
    const lock = await withAuth(request(app).post(`/api/v1/showtimes/${showtimeId}/seats/lock`), customerCookies).send({
      seatIds: [seatId],
    });
    expect(lock.status).toBe(200);
    const order = await withAuth(request(app).post("/api/v1/orders"), customerCookies).send({
      showtimeId,
      seatIds: [seatId],
    });
    expect(order.status).toBe(201);

    // En produccion la llave de Redis expira sola con el mismo TTL; aqui se simula ese vencimiento en ambos lados.
    await prisma.showtimeSeat.update({ where: { id: seatId }, data: { lockExpiresAt: new Date(Date.now() - 1000) } });
    await redis.del(`seatlock:${seatId}`);
    const map = await request(app).get(`/api/v1/showtimes/${showtimeId}/seats`);
    expect(map.status).toBe(200);

    const expired = await prisma.order.findUniqueOrThrow({ where: { id: order.body.order.id } });
    expect(expired.status).toBe("EXPIRED");

    const again = await withAuth(request(app).post(`/api/v1/showtimes/${showtimeId}/seats/lock`), adminCookies).send({
      seatIds: [seatId],
    });
    expect(again.status).toBe(200);
    const reorder = await withAuth(request(app).post("/api/v1/orders"), adminCookies).send({
      showtimeId,
      seatIds: [seatId],
    });
    expect(reorder.status).toBe(201);
  });
});
