import request from "supertest";
import { createApp } from "@/app";
import { redis } from "@/lib/redis";

afterAll(() => {
  redis.disconnect();
});

describe("GET /api/v1/health", () => {
  it("responde 200 con estado ok", async () => {
    const app = createApp();
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok", service: "lumiere-api" });
  });
});

describe("Ruta inexistente", () => {
  it("responde 404 con formato de error consistente", async () => {
    const app = createApp();
    const response = await request(app).get("/api/v1/ruta-que-no-existe");

    expect(response.status).toBe(404);
    expect(response.body.error).toBeDefined();
  });
});
