import { z } from "zod";

export const reportQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
