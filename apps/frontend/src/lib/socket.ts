import { io, type Socket } from "socket.io-client";

let socket: Socket | undefined;

/**
 * Un solo socket compartido por pestaña. Conecta perezosamente (no al
 * cargar la app) - solo la pagina de seleccion de asientos lo necesita.
 * Ver docs/05-diagramas-uml.md y docs/backend/05-reservas.md.
 */
export function getSocket(): Socket {
  socket ??= io({ path: "/socket.io", withCredentials: true, autoConnect: false });
  return socket;
}

export function joinShowtimeRoom(showtimeId: string): () => void {
  const s = getSocket();
  if (!s.connected) s.connect();
  s.emit("showtime:join", showtimeId);

  return () => {
    s.emit("showtime:leave", showtimeId);
  };
}
