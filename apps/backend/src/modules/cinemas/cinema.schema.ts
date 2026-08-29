import { z } from "zod";
import { paginationSchema } from "@/utils/pagination";

export const createCinemaSchema = z.object({
  name: z.string().trim().min(1).max(150),
  address: z.string().trim().min(1).max(250),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  country: z.string().trim().min(1).max(100),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
});

export const updateCinemaSchema = createCinemaSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listCinemasQuerySchema = paginationSchema.extend({
  city: z.string().trim().min(1).max(100).optional(),
  search: z.string().trim().min(1).max(150).optional(),
});

export type CreateCinemaInput = z.infer<typeof createCinemaSchema>;
export type UpdateCinemaInput = z.infer<typeof updateCinemaSchema>;
export type ListCinemasQuery = z.infer<typeof listCinemasQuerySchema>;
