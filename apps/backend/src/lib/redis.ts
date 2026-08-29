import Redis from "ioredis";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";

/**
 * Cliente Redis compartido: bloqueo temporal de asientos (ver docs/05-diagramas-uml.md
 * seccion "Compra de boletos con bloqueo de asiento"), rate-limit store y colas BullMQ.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redis.on("error", (err) => {
  logger.error({ err }, "Error de conexion a Redis");
});

redis.on("connect", () => {
  logger.info("Conectado a Redis");
});
