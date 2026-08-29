import type { Server as SocketIOServer } from "socket.io";

let ioInstance: SocketIOServer | undefined;

/** Se llama una vez desde server.ts tras crear el servidor de sockets real. */
export function setIO(io: SocketIOServer): void {
  ioInstance = io;
}

export function showtimeRoom(showtimeId: string): string {
  return `showtime:${showtimeId}`;
}

/**
 * Emite un evento de dominio a todos los clientes viendo el mapa de
 * asientos de una funcion. No-op si no hay servidor de sockets activo
 * (ej. en tests de integracion que usan createApp() sin servidor HTTP real)
 * - el flujo HTTP nunca debe fallar por un problema de notificacion en vivo.
 */
export function emitSeatEvent(
  showtimeId: string,
  event: "seat:locked" | "seat:released" | "seat:sold",
  payload: unknown,
): void {
  ioInstance?.to(showtimeRoom(showtimeId)).emit(event, payload);
}
