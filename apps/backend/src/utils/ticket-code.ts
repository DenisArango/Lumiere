import { randomBytes } from "node:crypto";

/**
 * Codigo corto y legible para el QR del boleto (no es el identificador de
 * la orden - ese es un UUID interno que no conviene exponer en un QR
 * escaneado en la entrada de la sala).
 */
export function generateTicketCode(): string {
  return `LMR-${randomBytes(6).toString("hex").toUpperCase()}`;
}
