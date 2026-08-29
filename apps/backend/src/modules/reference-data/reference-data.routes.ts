import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { catchAsync } from "@/utils/catch-async";

/**
 * Datos de referencia de solo lectura (montados en /api/v1/ratings y
 * /api/v1/languages) - mismo patron que seat-types.routes.ts. Sembrados en
 * prisma/seed.ts, sin CRUD todavia porque no hay caso de uso real para
 * gestionarlos desde la app (cambian con muy poca frecuencia).
 */
export const ratingRouter = Router();

ratingRouter.get(
  "/",
  catchAsync(async (_req, res) => {
    const ratings = await prisma.movieRating.findMany({ orderBy: { minAge: "asc" } });
    res.status(200).json({ ratings });
  }),
);

export const languageRouter = Router();

languageRouter.get(
  "/",
  catchAsync(async (_req, res) => {
    const languages = await prisma.language.findMany({ orderBy: { name: "asc" } });
    res.status(200).json({ languages });
  }),
);
