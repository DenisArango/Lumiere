import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "@/app";
import { createSocketServer } from "@/sockets";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

async function bootstrap(): Promise<void> {
  const app = createApp();
  const httpServer = createServer(app);
  createSocketServer(httpServer);

  await prisma.$connect();
  logger.info("Conectado a PostgreSQL");

  httpServer.listen(env.PORT, () => {
    logger.info(`Lumiere API escuchando en http://localhost:${env.PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Recibida señal ${signal}, cerrando servidor con gracia...`);
    httpServer.close();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  logger.error({ err }, "Error fatal al iniciar el servidor");
  process.exit(1);
});
