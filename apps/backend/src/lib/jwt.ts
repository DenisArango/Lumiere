import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { env } from "@/config/env";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

/**
 * El access token es un JWT de vida corta (ver JWT_ACCESS_EXPIRES_IN). El
 * refresh token NO es un JWT - es un valor aleatorio opaco cuyo hash se
 * guarda en la tabla refresh_tokens (ver lib/refresh-token.ts) - esto
 * permite revocarlo individualmente en cualquier momento, algo que un JWT
 * autocontenido no permite sin infraestructura adicional de listas negras.
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}
