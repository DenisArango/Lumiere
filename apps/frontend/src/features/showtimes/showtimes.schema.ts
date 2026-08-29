import { z } from "zod";

export const showtimeFormSchema = z.object({
  movieId: z.string().uuid("Selecciona una película"),
  cinemaId: z.string().uuid("Selecciona un cine"),
  roomId: z.string().uuid("Selecciona una sala"),
  audioLanguageId: z.string().uuid("Selecciona el idioma de audio"),
  subtitleLanguageId: z.string().optional(),
  startTime: z.string().min(1, "Selecciona fecha y hora"),
  basePrice: z.coerce.number().positive("El precio debe ser mayor a 0"),
  format: z.enum(["TWO_D", "THREE_D"]),
});

export type ShowtimeFormValues = z.infer<typeof showtimeFormSchema>;
