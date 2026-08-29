import { z } from "zod";

export const validateTicketSchema = z.object({
  qrCode: z.string().trim().min(1, "El código es requerido"),
});

export type ValidateTicketInput = z.infer<typeof validateTicketSchema>;
