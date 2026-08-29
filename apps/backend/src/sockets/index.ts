import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";

/**
 * Servidor de Socket.io para el mapa de butacas en vivo (ver
 * docs/05-diagramas-uml.md - secuencia de compra de boletos). Los eventos
 * de dominio (seat:locked, seat:sold, seat:released) se registran desde el
 * modulo de reservas cuando ese modulo se construya; este archivo solo
 * expone la instancia compartida del servidor.
 */
export function createSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    logger.debug({ socketId: socket.id }, "Cliente conectado a websocket");

    socket.on("disconnect", () => {
      logger.debug({ socketId: socket.id }, "Cliente desconectado de websocket");
    });
  });

  return io;
}
