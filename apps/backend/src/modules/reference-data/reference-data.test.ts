import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const app = createApp();

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit().catch(() => undefined);
});

describe("Datos de referencia", () => {
  it("lista clasificaciones sembradas por el seed", async () => {
    const res = await request(app).get("/api/v1/ratings");
    expect(res.status).toBe(200);
    expect(res.body.ratings.length).toBeGreaterThan(0);
    expect(res.body.ratings[0]).toHaveProperty("code");
  });

  it("lista idiomas sembrados por el seed", async () => {
    const res = await request(app).get("/api/v1/languages");
    expect(res.status).toBe(200);
    expect(res.body.languages.length).toBeGreaterThan(0);
    expect(res.body.languages[0]).toHaveProperty("code");
  });
});
