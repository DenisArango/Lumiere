import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { ForbiddenError, UnauthorizedError } from "@/utils/app-error";

/**
 * RBAC por rol. Debe usarse siempre despues de `authenticate`. Ejemplo:
 * router.post("/cinemas", authenticate, authorize("SUPER_ADMIN"), handler)
 */
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new ForbiddenError());
      return;
    }

    next();
  };
}
