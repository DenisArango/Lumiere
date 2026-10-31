import type { NextFunction, Request, Response } from "express";
import { authenticate } from "@/middleware/authenticate";
import { authorize } from "@/middleware/authorize";

/**
 * Los listados publicos (cines, productos, promociones) ocultan lo
 * desactivado. El panel necesita verlo para poder reactivarlo, asi que
 * `?includeInactive=true` se permite solo a SUPER_ADMIN / CINEMA_MANAGER:
 * sin ese parametro la ruta sigue siendo publica y no exige sesion.
 */
export function requireStaffForInactive(req: Request, res: Response, next: NextFunction): void {
  if (req.query.includeInactive !== "true") {
    next();
    return;
  }

  authenticate(req, res, (authError?: unknown) => {
    if (authError) {
      next(authError);
      return;
    }
    authorize("SUPER_ADMIN", "CINEMA_MANAGER")(req, res, next);
  });
}

export function wantsInactive(req: Request): boolean {
  return req.query.includeInactive === "true";
}
