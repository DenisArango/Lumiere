import { z } from "zod";

const currentYear = new Date().getFullYear();

export const movieFormSchema = z.object({
  title: z.string().trim().min(1, "El título es requerido").max(200),
  originalTitle: z.string().trim().max(200).optional().or(z.literal("")),
  synopsis: z.string().trim().min(1, "La sinopsis es requerida").max(3000),
  durationMinutes: z.coerce.number().int().positive().max(1000),
  releaseYear: z.coerce.number().int().min(1888).max(currentYear + 5),
  countryOfOrigin: z.string().trim().min(1, "El país es requerido").max(100),
  posterUrl: z.string().trim().url("URL inválida").optional().or(z.literal("")),
  backdropUrl: z.string().trim().url("URL inválida").optional().or(z.literal("")),
  trailerUrl: z.string().trim().url("URL inválida").optional().or(z.literal("")),
  status: z.enum(["COMING_SOON", "IN_THEATERS", "ARCHIVED"]),
  ratingId: z.string().uuid("Selecciona una clasificación"),
  originalLanguageId: z.string().uuid("Selecciona un idioma"),
});

export type MovieFormValues = z.infer<typeof movieFormSchema>;
