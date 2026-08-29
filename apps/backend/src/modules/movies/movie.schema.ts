import { z } from "zod";
import { CreditRole, MovieStatus } from "@prisma/client";
import { paginationSchema } from "@/utils/pagination";

const currentYear = new Date().getFullYear();

const creditInputSchema = z.object({
  personId: z.string().uuid(),
  creditRole: z.nativeEnum(CreditRole),
  characterName: z.string().trim().max(150).optional(),
  billingOrder: z.coerce.number().int().min(0).default(0),
});

export const createMovieSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    originalTitle: z.string().trim().max(200).optional(),
    synopsis: z.string().trim().min(1).max(3000),
    durationMinutes: z.coerce.number().int().positive().max(1000),
    releaseYear: z.coerce.number().int().min(1888).max(currentYear + 5),
    countryOfOrigin: z.string().trim().min(1).max(100),
    posterUrl: z.string().trim().url().optional(),
    backdropUrl: z.string().trim().url().optional(),
    trailerUrl: z.string().trim().url().optional(),
    status: z.nativeEnum(MovieStatus).default(MovieStatus.COMING_SOON),
    ratingId: z.string().uuid(),
    originalLanguageId: z.string().uuid(),
    genreIds: z.array(z.string().uuid()).min(1, "Debe tener al menos un género"),
    credits: z.array(creditInputSchema).min(1, "Debe tener al menos un director o actor"),
  })
  .superRefine((data, ctx) => {
    if (!data.credits.some((c) => c.creditRole === CreditRole.DIRECTOR)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["credits"],
        message: "Debe incluir al menos un director",
      });
    }
  });

export const updateMovieSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  originalTitle: z.string().trim().max(200).optional(),
  synopsis: z.string().trim().min(1).max(3000).optional(),
  durationMinutes: z.coerce.number().int().positive().max(1000).optional(),
  releaseYear: z.coerce.number().int().min(1888).max(currentYear + 5).optional(),
  countryOfOrigin: z.string().trim().min(1).max(100).optional(),
  posterUrl: z.string().trim().url().optional(),
  backdropUrl: z.string().trim().url().optional(),
  trailerUrl: z.string().trim().url().optional(),
  status: z.nativeEnum(MovieStatus).optional(),
  ratingId: z.string().uuid().optional(),
  originalLanguageId: z.string().uuid().optional(),
  genreIds: z.array(z.string().uuid()).min(1).optional(),
  credits: z.array(creditInputSchema).min(1).optional(),
});

export const listMoviesQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(MovieStatus).optional(),
  genreId: z.string().uuid().optional(),
  search: z.string().trim().min(1).max(150).optional(),
});

export type CreateMovieInput = z.infer<typeof createMovieSchema>;
export type UpdateMovieInput = z.infer<typeof updateMovieSchema>;
export type ListMoviesQuery = z.infer<typeof listMoviesQuerySchema>;
