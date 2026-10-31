import { z } from "zod";
import { PaymentProvider } from "@prisma/client";

export const payOrderSchema = z.object({
  provider: z.nativeEnum(PaymentProvider),
  /** Token de pago ya tokenizado en el frontend (Stripe PaymentMethod id / PayPal order id aprobada) - nunca datos de tarjeta crudos. */
  source: z.string().trim().min(1),
});

/** Cierre de un pago que quedo esperando 3D Secure: el id del PaymentIntent que Stripe devolvio al cobrar. */
export const confirmPaymentSchema = z.object({
  paymentIntentId: z.string().trim().min(1),
});

export const checkoutSessionSchema = z.object({
  provider: z.nativeEnum(PaymentProvider),
});

export type PayOrderInput = z.infer<typeof payOrderSchema>;
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;
export type CheckoutSessionInput = z.infer<typeof checkoutSessionSchema>;
