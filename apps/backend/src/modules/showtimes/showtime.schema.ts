import { z } from "zod";
import { ShowtimeFormat, ShowtimeStatus } from "@prisma/client";
import { paginationSchema } from "@/utils/pagination";

export const createShowtimeSchema = z.object({
  movieId: z.string().uuid(),
  roomId: z.string().uuid(),
  audioLanguageId: z.string().uuid(),
  subtitleLanguageId: z.string().uuid().optional(),
  startTime: z.coerce.date().refine((d) => d.getTime() > Date.now(), {
    message: "La función debe programarse en el futuro",
  }),
  basePrice: z.coerce.number().positive().max(10000),
  format: z.nativeEnum(ShowtimeFormat).default(ShowtimeFormat.TWO_D),
});

export const updateShowtimeSchema = z.object({
  basePrice: z.coerce.number().positive().max(10000).optional(),
  status: z.nativeEnum(ShowtimeStatus).optional(),
});

export const listShowtimesQuerySchema = paginationSchema.extend({
  movieId: z.string().uuid().optional(),
  cinemaId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha esperado: YYYY-MM-DD")
    .optional(),
});

export type CreateShowtimeInput = z.infer<typeof createShowtimeSchema>;
export type UpdateShowtimeInput = z.infer<typeof updateShowtimeSchema>;
export type ListShowtimesQuery = z.infer<typeof listShowtimesQuerySchema>;
