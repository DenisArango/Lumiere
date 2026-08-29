import argon2 from "argon2";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const app = createApp();

const suffix = Date.now();
const adminEmail = `test.catalog.admin.${suffix}@lumiere.test`;
const customerEmail = `test.catalog.customer.${suffix}@lumiere.test`;
const password = "Sup3rSecret!";

let adminCookies: { access: string; csrf: string };
let customerCookies: { access: string; csrf: string };
let ratingId: string;
let languageId: string;
let genreId: string;
let personId: string;
let movieId: string;

function asArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractCookie(cookies: string | string[] | undefined, name: string): string {
  const raw = asArray(cookies).find((c) => c.startsWith(`${name}=`));
  const value = raw?.split(";")[0]?.split("=")[1];
  if (!value) throw new Error(`Cookie ${name} no encontrada en la respuesta`);
  return value;
}

async function loginAs(email: string): Promise<{ access: string; csrf: string }> {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password });
  const cookies = res.get("set-cookie");
  return {
    access: extractCookie(cookies, "access_token"),
    csrf: extractCookie(cookies, "csrf_token"),
  };
}

beforeAll(async () => {
  const passwordHash = await argon2.hash(password);

  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      firstName: "Admin",
      lastName: "Test",
      role: "SUPER_ADMIN",
    },
  });
  await prisma.user.create({
    data: {
      email: customerEmail,
      passwordHash,
      firstName: "Cliente",
      lastName: "Test",
      role: "CUSTOMER",
    },
  });

  const rating = await prisma.movieRating.findFirstOrThrow();
  const language = await prisma.language.findFirstOrThrow();
  ratingId = rating.id;
  languageId = language.id;

  adminCookies = await loginAs(adminEmail);
  customerCookies = await loginAs(customerEmail);
});

afterAll(async () => {
  if (movieId) await prisma.movie.deleteMany({ where: { id: movieId } });
  if (personId) await prisma.person.deleteMany({ where: { id: personId } });
  if (genreId) await prisma.genre.deleteMany({ where: { id: genreId } });
  await prisma.user.deleteMany({ where: { email: { in: [adminEmail, customerEmail] } } });
  await prisma.$disconnect();
  await redis.quit().catch(() => undefined);
});

describe("Géneros", () => {
  it("lista géneros sin autenticación", async () => {
    const res = await request(app).get("/api/v1/genres");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.genres)).toBe(true);
  });

  it("rechaza crear género sin autenticación", async () => {
    const res = await request(app).post("/api/v1/genres").send({ name: "Neo-noir de prueba" });
    expect(res.status).toBe(401);
  });

  it("rechaza crear género como CUSTOMER (RBAC)", async () => {
    const res = await request(app)
      .post("/api/v1/genres")
      .set("Cookie", [`access_token=${customerCookies.access}`, `csrf_token=${customerCookies.csrf}`])
      .set("x-csrf-token", customerCookies.csrf)
      .send({ name: "Neo-noir de prueba" });
    expect(res.status).toBe(403);
  });

  it("permite crear género como SUPER_ADMIN", async () => {
    const res = await request(app)
      .post("/api/v1/genres")
      .set("Cookie", [`access_token=${adminCookies.access}`, `csrf_token=${adminCookies.csrf}`])
      .set("x-csrf-token", adminCookies.csrf)
      .send({ name: `Neo-noir de prueba ${suffix}` });

    expect(res.status).toBe(201);
    genreId = res.body.genre.id;
  });
});

describe("Personas (directores/actores)", () => {
  it("crea una persona (director de prueba)", async () => {
    const res = await request(app)
      .post("/api/v1/people")
      .set("Cookie", [`access_token=${adminCookies.access}`, `csrf_token=${adminCookies.csrf}`])
      .set("x-csrf-token", adminCookies.csrf)
      .send({ firstName: "Directora", lastName: `DePrueba${suffix}` });

    expect(res.status).toBe(201);
    personId = res.body.person.id;
  });

  it("una persona sin créditos tiene contadores en cero", async () => {
    const res = await request(app).get(`/api/v1/people/${personId}`);
    expect(res.status).toBe(200);
    expect(res.body.person.movieCounts).toEqual({ asDirector: 0, asActor: 0 });
  });
});

describe("Películas", () => {
  it("rechaza crear película sin director en los créditos", async () => {
    const res = await request(app)
      .post("/api/v1/movies")
      .set("Cookie", [`access_token=${adminCookies.access}`, `csrf_token=${adminCookies.csrf}`])
      .set("x-csrf-token", adminCookies.csrf)
      .send({
        title: "Película sin director",
        synopsis: "Sinopsis de prueba",
        durationMinutes: 100,
        releaseYear: 2026,
        countryOfOrigin: "México",
        ratingId,
        originalLanguageId: languageId,
        genreIds: [genreId],
        credits: [{ personId, creditRole: "ACTOR" }],
      });
    expect(res.status).toBe(422);
  });

  it("crea una película completa como SUPER_ADMIN", async () => {
    const res = await request(app)
      .post("/api/v1/movies")
      .set("Cookie", [`access_token=${adminCookies.access}`, `csrf_token=${adminCookies.csrf}`])
      .set("x-csrf-token", adminCookies.csrf)
      .send({
        title: `Película de prueba ${suffix}`,
        synopsis: "Sinopsis de prueba",
        durationMinutes: 118,
        releaseYear: 2026,
        countryOfOrigin: "México",
        status: "COMING_SOON",
        ratingId,
        originalLanguageId: languageId,
        genreIds: [genreId],
        credits: [{ personId, creditRole: "DIRECTOR", billingOrder: 0 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.movie.title).toBe(`Película de prueba ${suffix}`);
    movieId = res.body.movie.id;
  });

  it("el detalle incluye género y director", async () => {
    const res = await request(app).get(`/api/v1/movies/${movieId}`);
    expect(res.status).toBe(200);
    expect(res.body.movie.genres).toHaveLength(1);
    expect(res.body.movie.directors).toHaveLength(1);
    expect(res.body.movie.directors[0].id).toBe(personId);
  });

  it("el contador de la persona ahora refleja 1 película como director", async () => {
    const res = await request(app).get(`/api/v1/people/${personId}`);
    expect(res.body.person.movieCounts).toEqual({ asDirector: 1, asActor: 0 });
  });

  it("la lista filtra por género", async () => {
    const res = await request(app).get(`/api/v1/movies?genreId=${genreId}`);
    expect(res.status).toBe(200);
    expect(res.body.items.some((m: { id: string }) => m.id === movieId)).toBe(true);
  });

  it("PATCH actualiza el estado a IN_THEATERS", async () => {
    const res = await request(app)
      .patch(`/api/v1/movies/${movieId}`)
      .set("Cookie", [`access_token=${adminCookies.access}`, `csrf_token=${adminCookies.csrf}`])
      .set("x-csrf-token", adminCookies.csrf)
      .send({ status: "IN_THEATERS" });

    expect(res.status).toBe(200);
    expect(res.body.movie.status).toBe("IN_THEATERS");
  });

  it("rechaza actualizar como CUSTOMER (RBAC)", async () => {
    const res = await request(app)
      .patch(`/api/v1/movies/${movieId}`)
      .set("Cookie", [`access_token=${customerCookies.access}`, `csrf_token=${customerCookies.csrf}`])
      .set("x-csrf-token", customerCookies.csrf)
      .send({ status: "ARCHIVED" });
    expect(res.status).toBe(403);
  });

  it("404 en película inexistente", async () => {
    const res = await request(app).get("/api/v1/movies/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });
});
