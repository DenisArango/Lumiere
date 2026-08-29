import { z } from "zod";
import { PaymentProvider } from "@prisma/client";

export const payOrderSchema = z.object({
  provider: z.nativeEnum(PaymentProvider),
  /** Token de pago ya tokenizado en el frontend (Stripe PaymentMethod id / PayPal order id aprobada) - nunca datos de tarjeta crudos. */
  source: z.string().trim().min(1),
});

export type PayOrderInput = z.infer<typeof payOrderSchema>;
