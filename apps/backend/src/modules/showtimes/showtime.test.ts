import argon2 from "argon2";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const app = createApp();

const suffix = Date.now();
const adminEmail = `test.showtimes.admin.${suffix}@lumiere.test`;
const password = "Sup3rSecret!";

let adminCookies: { access: string; csrf: string };
let cinemaId: string;
let roomId: string;
let movieId: string;
let personId: string;
let genreId: string;
let ratingId: string;
let languageId: string;
let showtimeId: string;

function extractCookie(cookies: string | string[] | undefined, name: string): string {
  const arr = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
  const raw = arr.find((c) => c.startsWith(`${name}=`));
  const value = raw?.split(";")[0]?.split("=")[1];
  if (!value) throw new Error(`Cookie ${name} no encontrada`);
  return value;
}

function authed(req: request.Test): request.Test {
  return req
    .set("Cookie", [`access_token=${adminCookies.access}`, `csrf_token=${adminCookies.csrf}`])
    .set("x-csrf-token", adminCookies.csrf);
}

beforeAll(async () => {
  const passwordHash = await argon2.hash(password);
  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      firstName: "Admin",
      lastName: "Funciones",
      role: "SUPER_ADMIN",
    },
  });

  const loginRes = await request(app).post("/api/v1/auth/login").send({ email: adminEmail, password });
  const cookies = loginRes.get("set-cookie");
  adminCookies = {
    access: extractCookie(cookies, "access_token"),
    csrf: extractCookie(cookies, "csrf_token"),
  };

  const rating = await prisma.movieRating.findFirstOrThrow();
  const language = await prisma.language.findFirstOrThrow();
  const seatType = await prisma.seatType.findFirstOrThrow();
  ratingId = rating.id;
  languageId = language.id;

  const cinema = await prisma.cinema.create({
    data: {
      name: `Cine funciones ${suffix}`,
      address: "Av. Prueba 1",
      city: "Ciudad",
      state: "Estado",
      country: "País",
    },
  });
  cinemaId = cinema.id;

  const room = await prisma.room.create({
    data: { cinemaId, name: "Sala funciones", roomType: "STANDARD", totalCapacity: 6 },
  });
  roomId = room.id;
  await prisma.seat.createMany({
    data: Array.from({ length: 6 }, (_, i) => ({
      roomId,
      rowLabel: "A",
      seatNumber: i + 1,
      seatTypeId: seatType.id,
    })),
  });

  const person = await prisma.person.create({
    data: { firstName: "Directora", lastName: `Funciones${suffix}` },
  });
  personId = person.id;

  const genre = await prisma.genre.create({ data: { name: `Género funciones ${suffix}` } });
  genreId = genre.id;

  const movie = await prisma.movie.create({
    data: {
      title: `Película funciones ${suffix}`,
      synopsis: "Sinopsis",
      durationMinutes: 100,
      releaseYear: 2026,
      countryOfOrigin: "México",
      ratingId,
      originalLanguageId: languageId,
      genres: { create: [{ genreId }] },
      credits: { create: [{ personId, creditRole: "DIRECTOR" }] },
    },
  });
  movieId = movie.id;
});

afterAll(async () => {
  await prisma.showtimeSeat.deleteMany({ where: { showtime: { movieId } } });
  await prisma.showtime.deleteMany({ where: { movieId } });
  await prisma.movie.deleteMany({ where: { id: movieId } });
  await prisma.person.deleteMany({ where: { id: personId } });
  await prisma.genre.deleteMany({ where: { id: genreId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.cinema.deleteMany({ where: { id: cinemaId } });
  await prisma.user.deleteMany({ where: { email: adminEmail } });
  await prisma.$disconnect();
  await redis.quit().catch(() => undefined);
});

describe("Funciones", () => {
  it("rechaza crear función en el pasado", async () => {
    const res = await authed(request(app).post("/api/v1/showtimes")).send({
      movieId,
      roomId,
      audioLanguageId: languageId,
      startTime: "2020-01-01T20:00:00.000Z",
      basePrice: 80,
    });
    expect(res.status).toBe(422);
  });

  it("crea una función y materializa el mapa de butacas (6 disponibles)", async () => {
    const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const res = await authed(request(app).post("/api/v1/showtimes")).send({
      movieId,
      roomId,
      audioLanguageId: languageId,
      startTime,
      basePrice: 85.5,
      format: "TWO_D",
    });

    expect(res.status).toBe(201);
    showtimeId = res.body.showtime.id;

    const detail = await request(app).get(`/api/v1/showtimes/${showtimeId}`);
    expect(detail.body.showtime.availableSeats).toBe(6);
  });

  it("rechaza una segunda función que se cruza en horario en la misma sala", async () => {
    const overlappingStart = new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString();
    const res = await authed(request(app).post("/api/v1/showtimes")).send({
      movieId,
      roomId,
      audioLanguageId: languageId,
      startTime: overlappingStart,
      basePrice: 85.5,
    });
    expect(res.status).toBe(409);
  });

  it("permite una función más tarde el mismo día sin cruce (después del turnaround)", async () => {
    // pelicula dura 100 min + 20 min de turnaround = 120 min de bloqueo
    const laterStart = new Date(Date.now() + 24 * 60 * 60 * 1000 + 130 * 60 * 1000).toISOString();
    const res = await authed(request(app).post("/api/v1/showtimes")).send({
      movieId,
      roomId,
      audioLanguageId: languageId,
      startTime: laterStart,
      basePrice: 85.5,
    });
    expect(res.status).toBe(201);
  });

  it("lista funciones filtradas por película", async () => {
    const res = await request(app).get(`/api/v1/showtimes?movieId=${movieId}&pageSize=50`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
  });

  it("actualiza el estado de una función a CANCELLED", async () => {
    const res = await authed(request(app).patch(`/api/v1/showtimes/${showtimeId}`)).send({
      status: "CANCELLED",
    });
    expect(res.status).toBe(200);
    expect(res.body.showtime.status).toBe("CANCELLED");
  });

  it("una función cancelada ya no bloquea el horario de una nueva función", async () => {
    const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const res = await authed(request(app).post("/api/v1/showtimes")).send({
      movieId,
      roomId,
      audioLanguageId: languageId,
      startTime,
      basePrice: 90,
    });
    expect(res.status).toBe(201);
  });
});
