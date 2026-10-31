import type { PaymentProvider } from "@prisma/client";
import { env } from "@/config/env";
import { AppError } from "@/utils/app-error";

/**
 * El programa trabaja SIEMPRE en una moneda (PAYMENT_CURRENCY, p. ej. GTQ): precios, totales, descuentos y
 * puntos. Cada proveedor de pago puede cobrar en otra moneda segun su cuenta (Stripe en MXN, PayPal en USD):
 * solo el COBRO se convierte, con un tipo de cambio fijo y configurable. Asi el cliente ve un precio estable
 * y la orden se guarda siempre en la moneda de la tienda.
 *
 * El tipo de cambio es "unidades de la tienda por 1 unidad del proveedor" (7.7 = 7.7 GTQ por 1 USD).
 */
export interface ProviderCharge {
  /** Monto a cobrar en la moneda del proveedor, con 2 decimales. */
  value: number;
  currency: string;
}

export function providerCurrency(provider: PaymentProvider): string {
  const currency = provider === "STRIPE" ? (env.STRIPE_CURRENCY ?? env.PAYMENT_CURRENCY) : env.PAYPAL_CURRENCY;
  return currency.toUpperCase();
}

/** 1 si el proveedor cobra en la moneda de la tienda; si no, el tipo de cambio configurado (o null si falta). */
export function providerRate(provider: PaymentProvider): number | null {
  if (providerCurrency(provider) === env.PAYMENT_CURRENCY.toUpperCase()) return 1;
  return (provider === "STRIPE" ? env.STRIPE_RATE : env.PAYPAL_RATE) ?? null;
}

export function toProviderAmount(provider: PaymentProvider, amount: number): ProviderCharge {
  const currency = providerCurrency(provider);
  const rate = providerRate(provider);
  if (rate === null) {
    throw new AppError(
      `${provider === "STRIPE" ? "Stripe" : "PayPal"} cobra en ${currency} y la tienda en ${env.PAYMENT_CURRENCY}: falta el tipo de cambio (${provider}_RATE) para convertir el monto`,
      503,
    );
  }
  return { value: Math.round((amount / rate) * 100) / 100, currency };
}
