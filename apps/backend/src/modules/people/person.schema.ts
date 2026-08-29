import { z } from "zod";
import { paginationSchema } from "@/utils/pagination";

export const createPersonSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  bio: z.string().trim().max(5000).optional(),
  photoUrl: z.string().trim().url().optional(),
  birthDate: z.coerce.date().optional(),
  nationality: z.string().trim().max(100).optional(),
});

export const updatePersonSchema = createPersonSchema.partial();

export const listPeopleQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
});

export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
export type ListPeopleQuery = z.infer<typeof listPeopleQuerySchema>;
