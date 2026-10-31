import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { createTestUser, loginAs, withAuth, TEST_PASSWORD, type Cookies } from "@/test-utils/fixtures";

const app = createApp();
const suffix = `audit${Date.now()}`;
const adminEmail = `test.audit.admin.${suffix}@lumiere.test`;
const managerEmail = `test.audit.manager.${suffix}@lumiere.test`;
const customerEmail = `test.audit.customer.${suffix}@lumiere.test`;
const createdEmail = `test.audit.created.${suffix}@lumiere.test`;

let admin: Cookies;
let manager: Cookies;
let customer: Cookies;
let adminId: string;

beforeAll(async () => {
  adminId = (await createTestUser(adminEmail, "SUPER_ADMIN")).id;
  await createTestUser(managerEmail, "CINEMA_MANAGER");
  await createTestUser(customerEmail);
  [admin, manager, customer] = await Promise.all([loginAs(app, adminEmail), loginAs(app, managerEmail), loginAs(app, customerEmail)]);
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { OR: [{ user: { email: { contains: suffix } } }, { entityType: "Genre", metadata: { path: ["name"], string_contains: suffix } }] } });
  await prisma.genre.deleteMany({ where: { name: { contains: suffix } } });
  await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
  await prisma.$disconnect();
  await redis.quit().catch(() => undefined);
});

// El registro se escribe cuando la respuesta termina; se espera un instante a que llegue.
async function waitForAudit(where: Record<string, unknown>) {
  for (let i = 0; i < 20; i += 1) {
    const row = await prisma.auditLog.findFirst({ where, orderBy: { createdAt: "desc" } });
    if (row) return row;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

describe("Bitácora de auditoría", () => {
  it("crear un usuario deja un registro con quién, qué y desde dónde, sin guardar la contraseña", async () => {
    const res = await withAuth(request(app).post("/api/v1/users"), admin).send({
      email: createdEmail,
      password: TEST_PASSWORD,
      firstName: "Nueva",
      lastName: "Cuenta",
      role: "BOX_OFFICE",
    });
    expect(res.status).toBe(201);

    const row = await waitForAudit({ action: "user.create", entityId: res.body.user.id });
    expect(row).not.toBeNull();
    expect(row?.userId).toBe(adminId);
    expect(row?.entityType).toBe("User");
    expect(JSON.stringify(row?.metadata)).not.toContain(TEST_PASSWORD);
    expect(row?.metadata).toMatchObject({ password: "[oculto]", role: "BOX_OFFICE" });
  });

  it("una acción rechazada (error) no deja registro", async () => {
    const before = await prisma.auditLog.count({ where: { action: "user.create" } });
    const dup = await withAuth(request(app).post("/api/v1/users"), admin).send({
      email: createdEmail,
      password: TEST_PASSWORD,
      firstName: "X",
      lastName: "Y",
      role: "BOX_OFFICE",
    });
    expect(dup.status).toBe(409);
    await new Promise((r) => setTimeout(r, 200));
    expect(await prisma.auditLog.count({ where: { action: "user.create" } })).toBe(before);
  });

  it("otras acciones de gestión también se registran (crear género)", async () => {
    const name = `Género ${suffix}`;
    const res = await withAuth(request(app).post("/api/v1/genres"), admin).send({ name });
    expect(res.status).toBe(201);
    const row = await waitForAudit({ action: "genre.create", entityType: "Genre" });
    expect(row).not.toBeNull();
  });

  it("solo SUPER_ADMIN lee la bitácora; se filtra por acción y trae el autor", async () => {
    expect((await request(app).get("/api/v1/audit-logs")).status).toBe(401);
    expect((await withAuth(request(app).get("/api/v1/audit-logs"), customer)).status).toBe(403);
    expect((await withAuth(request(app).get("/api/v1/audit-logs"), manager)).status).toBe(403);

    const res = await withAuth(request(app).get("/api/v1/audit-logs?action=user.create&pageSize=50"), admin);
    expect(res.status).toBe(200);
    const mine = res.body.items.find((i: { userId: string }) => i.userId === adminId);
    expect(mine.user.email).toBe(adminEmail);
    expect(res.body.items.every((i: { action: string }) => i.action.includes("user.create"))).toBe(true);
  });
});
