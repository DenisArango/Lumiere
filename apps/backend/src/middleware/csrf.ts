import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "@/utils/app-error";
import { CSRF_COOKIE } from "@/lib/cookies";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Proteccion CSRF por "double submit cookie": el frontend debe reenviar en
 * el header X-CSRF-Token el mismo valor que recibio en la cookie csrf_token
 * (no httpOnly) al autenticarse. Un sitio malicioso puede hacer que el
 * navegador de la victima envie la cookie automaticamente, pero no puede
 * leerla para poner el header (same-origin policy) - ver docs/06-seguridad.md.
 *
 * Login y registro quedan exentos: todavia no existe una sesion/cookie que
 * un atacante pueda explotar en nombre de la victima en ese punto.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.header("x-csrf-token");

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    next(new ForbiddenError("Token CSRF invalido o ausente"));
    return;
  }

  next();
}
