import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { showtimeRoom } from "@/lib/socket-server";

/**
 * Servidor de Socket.io para el mapa de butacas en vivo (ver
 * docs/05-diagramas-uml.md - secuencia de compra de boletos). Los eventos
 * de dominio (seat:locked, seat:released, seat:sold) los emite el modulo de
 * reservas via lib/socket-server.ts; aqui solo se gestiona la conexion y el
 * "room" por funcion al que el cliente se suscribe.
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

    socket.on("showtime:join", (showtimeId: string) => {
      socket.join(showtimeRoom(showtimeId));
    });

    socket.on("showtime:leave", (showtimeId: string) => {
      socket.leave(showtimeRoom(showtimeId));
    });

    socket.on("disconnect", () => {
      logger.debug({ socketId: socket.id }, "Cliente desconectado de websocket");
    });
  });

  return io;
}
