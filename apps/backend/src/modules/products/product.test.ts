import argon2 from "argon2";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const app = createApp();
const suffix = Date.now();
const password = "Sup3rSecret!";

const adminEmail = `test.products.admin.${suffix}@lumiere.test`;
const customerEmail = `test.products.customer.${suffix}@lumiere.test`;

let adminCookies: { access: string; csrf: string };
let customerCookies: { access: string; csrf: string };
let productId: string;

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
    data: { email: adminEmail, passwordHash, firstName: "Admin", lastName: "Products", role: "SUPER_ADMIN" },
  });
  await prisma.user.create({
    data: { email: customerEmail, passwordHash, firstName: "Cliente", lastName: "Products" },
  });
  adminCookies = await loginAs(adminEmail);
  customerCookies = await loginAs(customerEmail);
});

afterAll(async () => {
  if (productId) await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.user.deleteMany({ where: { email: { in: [adminEmail, customerEmail] } } });
  await prisma.$disconnect();
  await redis.quit().catch(() => undefined);
});

describe("Productos (combos de dulcería)", () => {
  it("rechaza crear producto sin autenticación", async () => {
    const res = await request(app).post("/api/v1/products").send({ name: "Combo", price: 60 });
    expect(res.status).toBe(401);
  });

  it("rechaza crear producto como CUSTOMER (RBAC)", async () => {
    const res = await withAuth(request(app).post("/api/v1/products"), customerCookies).send({
      name: "Combo",
      price: 60,
    });
    expect(res.status).toBe(403);
  });

  it("SUPER_ADMIN crea un producto", async () => {
    const res = await withAuth(request(app).post("/api/v1/products"), adminCookies).send({
      name: `Combo Grande ${suffix}`,
      description: "Palomitas grandes + refresco",
      price: 89.5,
    });
    expect(res.status).toBe(201);
    expect(res.body.product.isActive).toBe(true);
    productId = res.body.product.id;
  });

  it("el listado público incluye el producto activo", async () => {
    const res = await request(app).get("/api/v1/products");
    expect(res.status).toBe(200);
    expect(res.body.products.some((p: { id: string }) => p.id === productId)).toBe(true);
  });

  it("SUPER_ADMIN desactiva el producto y desaparece del listado público", async () => {
    const patchRes = await withAuth(request(app).patch(`/api/v1/products/${productId}`), adminCookies).send({
      isActive: false,
    });
    expect(patchRes.status).toBe(200);

    const listRes = await request(app).get("/api/v1/products");
    expect(listRes.body.products.some((p: { id: string }) => p.id === productId)).toBe(false);
  });

  it("404 al actualizar un producto inexistente", async () => {
    const res = await withAuth(
      request(app).patch("/api/v1/products/00000000-0000-0000-0000-000000000000"),
      adminCookies,
    ).send({ price: 10 });
    expect(res.status).toBe(404);
  });
});
