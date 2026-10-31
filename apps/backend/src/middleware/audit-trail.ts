import type { NextFunction, Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { recordAudit } from "@/modules/audit/audit.service";

const SENSITIVE_KEY = /pass(word)?|secret|token|authorization/i;

/** Quita contrasenas, tokens y secretos antes de guardar el cuerpo de la peticion en la bitacora. */
function sanitize(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const clean: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) {
      clean[key] = "[oculto]";
    } else if (v === null || ["string", "number", "boolean"].includes(typeof v) || Array.isArray(v) || typeof v === "object") {
      clean[key] = v as Prisma.InputJsonValue;
    }
  }
  return clean;
}

/** Busca el id de la entidad creada en la respuesta ({ cinema: { id } } -> id). */
function idFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  for (const value of Object.values(body as Record<string, unknown>)) {
    if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") {
      return (value as { id: string }).id;
    }
  }
  return undefined;
}

/**
 * Bitacora de acciones de gestion. Se agrega a una ruta mutante (despues de la autenticacion) y registra
 * quien la hizo, desde donde y con que datos, SOLO si la respuesta fue exitosa. Nunca guarda contrasenas.
 *
 *   router.patch("/:id", authenticate, authorize(...), auditTrail("cinema.update", "Cinema"), controller)
 */
export function auditTrail(action: string, entityType: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    let responseBody: unknown;
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      responseBody = body;
      return originalJson(body);
    };

    res.on("finish", () => {
      if (res.statusCode >= 400) return;
      void recordAudit({
        userId: req.user?.id,
        action,
        entityType,
        entityId: (req.params.id as string | undefined) ?? idFromBody(responseBody),
        metadata: sanitize(req.body),
        ipAddress: req.ip,
      });
    });

    next();
  };
}
