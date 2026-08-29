import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "@/utils/app-error";
import { logger } from "@/lib/logger";
import { isProduction } from "@/config/env";

/**
 * Middleware centralizado de errores. Nunca expone stack traces ni
 * detalles internos en produccion (ver docs/06-seguridad.md).
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        message: "Datos de entrada invalidos",
        details: err.flatten().fieldErrors,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path }, err.message);
    }
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  logger.error({ err, path: req.path }, "Error no manejado");

  res.status(500).json({
    error: {
      message: isProduction ? "Error interno del servidor" : String(err),
    },
  });
}
