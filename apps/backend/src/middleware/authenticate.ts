import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "@/lib/jwt";
import { getAccessTokenCookie } from "@/lib/cookies";
import { UnauthorizedError } from "@/utils/app-error";

/**
 * Verifica el access token (JWT) enviado en cookie httpOnly y adjunta
 * req.user. Nunca confia en un rol enviado por el cliente por otra via
 * (body, header) - el rol siempre viene del token firmado por el servidor.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = getAccessTokenCookie(req.cookies ?? {});

  if (!token) {
    next(new UnauthorizedError("No autenticado"));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new UnauthorizedError("Sesion invalida o expirada"));
  }
}
