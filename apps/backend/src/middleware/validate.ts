import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

type ValidationTarget = "body" | "query" | "params";

/**
 * Middleware generico de validacion Zod. Todo endpoint mutante debe validar
 * su entrada con esto antes de llegar al controller (ver Definition of Done
 * en docs/02-metodologia.md). Los errores de ZodError son capturados por
 * errorHandler y devueltos como 422 con detalle por campo.
 */
export function validate(schema: ZodTypeAny, target: ValidationTarget = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req[target] = schema.parse(req[target]);
    next();
  };
}
