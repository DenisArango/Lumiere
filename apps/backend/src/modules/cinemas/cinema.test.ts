import argon2 from "argon2";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const app = createApp();

const suffix = Date.now();
const adminEmail = `test.cinemas.admin.${suffix}@lumiere.test`;
const password = "Sup3rSecret!";

let adminCookies: { access: string; csrf: string };
let seatTypeId: string;
let cinemaId: string;
let roomId: string;

function extractCookie(cookies: string | string[] | undefined, name: string): string {
  const arr = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
  const raw = arr.find((c) => c.startsWith(`${name}=`));
  const value = raw?.split(";")[0]?.split("=")[1];
  if (!value) throw new Error(`Cookie ${name} no encontrada`);
  return value;
}

beforeAll(async () => {
  const passwordHash = await argon2.hash(password);
  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      firstName: "Admin",
      lastName: "Cines",
      role: "SUPER_ADMIN",
    },
  });

  const loginRes = await request(app).post("/api/v1/auth/login").send({ email: adminEmail, password });
  const cookies = loginRes.get("set-cookie");
  adminCookies = {
    access: extractCookie(cookies, "access_token"),
    csrf: extractCookie(cookies, "csrf_token"),
  };

  const seatType = await prisma.seatType.findFirstOrThrow();
  seatTypeId = seatType.id;
});

afterAll(async () => {
  if (roomId) await prisma.room.deleteMany({ where: { id: roomId } });
  if (cinemaId) await prisma.cinema.deleteMany({ where: { id: cinemaId } });
  await prisma.user.deleteMany({ where: { email: adminEmail } });
  await prisma.$disconnect();
  await redis.quit().catch(() => undefined);
});

function authed(req: request.Test): request.Test {
  return req
    .set("Cookie", [`access_token=${adminCookies.access}`, `csrf_token=${adminCookies.csrf}`])
    .set("x-csrf-token", adminCookies.csrf);
}

describe("Cines", () => {
  it("rechaza crear cine sin autenticación", async () => {
    const res = await request(app).post("/api/v1/cinemas").send({
      name: "Cine de prueba",
      address: "Calle 1",
      city: "Ciudad",
      state: "Estado",
      country: "País",
    });
    expect(res.status).toBe(401);
  });

  it("crea un cine como SUPER_ADMIN", async () => {
    const res = await authed(request(app).post("/api/v1/cinemas")).send({
      name: `Cine de prueba ${suffix}`,
      address: "Av. Central 123",
      city: "Ciudad de prueba",
      state: "Estado",
      country: "País",
      phone: "5555555555",
    });

    expect(res.status).toBe(201);
    cinemaId = res.body.cinema.id;
  });

  it("lista cines públicamente e incluye el creado", async () => {
    const res = await request(app).get("/api/v1/cinemas?pageSize=50");
    expect(res.status).toBe(200);
    expect(res.body.items.some((c: { id: string }) => c.id === cinemaId)).toBe(true);
  });
});

describe("Salas y butacas", () => {
  it("rechaza crear sala con filas duplicadas", async () => {
    const res = await authed(request(app).post(`/api/v1/cinemas/${cinemaId}/rooms`)).send({
      name: "Sala 1",
      roomType: "STANDARD",
      rows: [
        { rowLabel: "A", seatCount: 5, seatTypeId },
        { rowLabel: "A", seatCount: 5, seatTypeId },
      ],
    });
    expect(res.status).toBe(422);
  });

  it("crea una sala y genera el mapa de butacas correctamente", async () => {
    const res = await authed(request(app).post(`/api/v1/cinemas/${cinemaId}/rooms`)).send({
      name: "Sala 1",
      roomType: "VIP",
      rows: [
        { rowLabel: "A", seatCount: 8, seatTypeId },
        { rowLabel: "B", seatCount: 10, seatTypeId },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.room.totalCapacity).toBe(18);
    roomId = res.body.room.id;
  });

  it("el mapa de butacas tiene exactamente 18 asientos, 8 en fila A y 10 en fila B", async () => {
    const res = await request(app).get(`/api/v1/rooms/${roomId}`);
    expect(res.status).toBe(200);
    expect(res.body.room.seats).toHaveLength(18);
    const rowA = res.body.room.seats.filter((s: { rowLabel: string }) => s.rowLabel === "A");
    const rowB = res.body.room.seats.filter((s: { rowLabel: string }) => s.rowLabel === "B");
    expect(rowA).toHaveLength(8);
    expect(rowB).toHaveLength(10);
  });

  it("rechaza crear una sala con el mismo nombre en el mismo cine", async () => {
    const res = await authed(request(app).post(`/api/v1/cinemas/${cinemaId}/rooms`)).send({
      name: "Sala 1",
      roomType: "STANDARD",
      rows: [{ rowLabel: "A", seatCount: 5, seatTypeId }],
    });
    expect(res.status).toBe(409);
  });

  it("el detalle del cine incluye la sala con su capacidad", async () => {
    const res = await request(app).get(`/api/v1/cinemas/${cinemaId}`);
    expect(res.status).toBe(200);
    expect(res.body.cinema.rooms).toHaveLength(1);
    expect(res.body.cinema.rooms[0].totalCapacity).toBe(18);
  });
});
