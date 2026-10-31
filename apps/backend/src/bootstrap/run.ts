import "dotenv/config";
import argon2 from "argon2";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { passwordSchema } from "@/modules/auth/auth.schema";
import { seedReferenceData } from "@/bootstrap/reference-data";

/**
 * Se ejecuta en cada despliegue, DESPUES de las migraciones y ANTES de arrancar el servidor
 * (ver Dockerfile). En un servicio sin terminal (plan gratuito de Render) es la unica forma de:
 *
 * 1. Tener los catalogos base (idiomas, clasificaciones, generos, tipos de butaca).
 * 2. Crear el PRIMER super administrador, sin dejar una cuenta con contrasena conocida en el codigo:
 *    el correo y la contrasena vienen de variables de entorno y solo se usan si todavia no existe
 *    ninguno. Despues se pueden quitar de la configuracion.
 *
 * Es idempotente: ejecutarlo de nuevo no duplica ni sobrescribe nada.
 */
async function main(): Promise<void> {
  await seedReferenceData(prisma);
  logger.info("Datos de referencia listos");

  const existing = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
  if (existing > 0) {
    logger.info("Ya existe un super administrador; no se crea otro");
    return;
  }

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) {
    logger.warn(
      "No hay super administrador y faltan BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD: nadie podrá entrar al panel",
    );
    return;
  }

  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) {
    logger.error(
      { reason: parsed.error.issues.map((i) => i.message) },
      "BOOTSTRAP_ADMIN_PASSWORD no cumple la política de contraseñas; no se crea el administrador",
    );
    process.exitCode = 1;
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await argon2.hash(password),
      firstName: "Administrador",
      lastName: "Lumière",
      role: "SUPER_ADMIN",
      emailVerifiedAt: new Date(),
    },
  });
  logger.info({ email }, "Super administrador inicial creado");
}

main()
  .catch((err) => {
    logger.error({ err }, "Falló el arranque inicial");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
