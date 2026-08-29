import { z } from "zod";

export const createGenreSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(50),
});

export type CreateGenreInput = z.infer<typeof createGenreSchema>;
