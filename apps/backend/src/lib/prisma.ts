import { PrismaClient } from "@prisma/client";
import { isProduction } from "@/config/env";

/**
 * Instancia unica de PrismaClient reutilizada en toda la app (evita agotar
 * el pool de conexiones de Postgres con multiples instancias, un error
 * comun con hot-reload en desarrollo).
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

export const prisma =
  global.__prisma__ ??
  new PrismaClient({
    log: isProduction ? ["error", "warn"] : ["warn"],
  });

if (!isProduction) {
  global.__prisma__ = prisma;
}
