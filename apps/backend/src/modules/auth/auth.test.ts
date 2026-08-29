import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const app = createApp();

const testEmail = `test.auth.${Date.now()}@lumiere.test`;
const testPassword = "Sup3rSecret!";

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: testEmail } });
  await prisma.$disconnect();
  redis.disconnect();
});

function asArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractCookie(cookies: string | string[] | undefined, name: string): string | undefined {
  const raw = asArray(cookies).find((c) => c.startsWith(`${name}=`));
  return raw?.split(";")[0]?.split("=")[1];
}

describe("Flujo de autenticación", () => {
  let refreshCookieHeader: string[] = [];
  let csrfToken = "";

  it("rechaza el registro con contraseña débil", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: testEmail,
      password: "weak",
      firstName: "Ada",
      lastName: "Lovelace",
    });
    expect(res.status).toBe(422);
  });

  it("registra un nuevo usuario y setea cookies de sesión", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: testEmail,
      password: testPassword,
      firstName: "Ada",
      lastName: "Lovelace",
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: testEmail, role: "CUSTOMER" });
    expect(res.body.user.passwordHash).toBeUndefined();

    const setCookie = asArray(res.get("set-cookie"));
    expect(extractCookie(setCookie, "access_token")).toBeDefined();
    expect(extractCookie(setCookie, "refresh_token")).toBeDefined();
    expect(extractCookie(setCookie, "csrf_token")).toBeDefined();
  });

  it("rechaza el registro de un email ya existente", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: testEmail,
      password: testPassword,
      firstName: "Ada",
      lastName: "Lovelace",
    });
    expect(res.status).toBe(409);
  });

  it("rechaza login con contraseña incorrecta", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: testEmail, password: "WrongPassword1" });
    expect(res.status).toBe(401);
  });

  it("permite login con credenciales correctas", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: testEmail, password: testPassword });

    expect(res.status).toBe(200);
    refreshCookieHeader = asArray(res.get("set-cookie"));
    csrfToken = extractCookie(refreshCookieHeader, "csrf_token") ?? "";
    expect(csrfToken).not.toBe("");
  });

  it("GET /me sin cookie de sesión responde 401", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("GET /me con cookie de sesión responde con el usuario", async () => {
    const accessToken = extractCookie(refreshCookieHeader, "access_token");
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", [`access_token=${accessToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testEmail);
  });

  it("/refresh sin token CSRF responde 403", async () => {
    const refreshToken = extractCookie(refreshCookieHeader, "refresh_token");
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", [`refresh_token=${refreshToken}`]);
    expect(res.status).toBe(403);
  });

  it("/refresh con CSRF válido rota el refresh token", async () => {
    const refreshToken = extractCookie(refreshCookieHeader, "refresh_token");
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", [`refresh_token=${refreshToken}`, `csrf_token=${csrfToken}`])
      .set("x-csrf-token", csrfToken);

    expect(res.status).toBe(200);
    const newCookies = asArray(res.get("set-cookie"));
    const newRefreshToken = extractCookie(newCookies, "refresh_token");
    expect(newRefreshToken).toBeDefined();
    expect(newRefreshToken).not.toBe(refreshToken);

    refreshCookieHeader = newCookies;
    csrfToken = extractCookie(newCookies, "csrf_token") ?? csrfToken;
  });

  it("el refresh token rotado (anterior) ya no sirve", async () => {
    const oldRefreshRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: testEmail, password: testPassword });
    const cookies = asArray(oldRefreshRes.get("set-cookie"));
    const oldRefreshToken = extractCookie(cookies, "refresh_token");
    const oldCsrf = extractCookie(cookies, "csrf_token") ?? "";

    // primer uso: valido
    const first = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", [`refresh_token=${oldRefreshToken}`, `csrf_token=${oldCsrf}`])
      .set("x-csrf-token", oldCsrf);
    expect(first.status).toBe(200);

    // reintentar el mismo refresh token ya rotado: invalido
    const second = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", [`refresh_token=${oldRefreshToken}`, `csrf_token=${oldCsrf}`])
      .set("x-csrf-token", oldCsrf);
    expect(second.status).toBe(401);
  });

  it("logout revoca la sesión", async () => {
    const refreshToken = extractCookie(refreshCookieHeader, "refresh_token");
    const logoutRes = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", [`refresh_token=${refreshToken}`, `csrf_token=${csrfToken}`])
      .set("x-csrf-token", csrfToken);
    expect(logoutRes.status).toBe(204);

    const refreshAfterLogout = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", [`refresh_token=${refreshToken}`, `csrf_token=${csrfToken}`])
      .set("x-csrf-token", csrfToken);
    expect(refreshAfterLogout.status).toBe(401);
  });
});
