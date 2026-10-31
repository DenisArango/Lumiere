import type { Request, Response } from "express";
import { env } from "@/config/env";
import * as paymentService from "@/modules/payments/payment.service";
import type {
  CheckoutSessionInput,
  ConfirmPaymentInput,
  PayOrderInput,
} from "@/modules/payments/payment.schema";
import { POINTS_PER_DISCOUNT_UNIT, MAX_REDEEM_SHARE } from "@/modules/users/loyalty";
import { providerCurrency, providerRate } from "@/modules/payments/currency";

const STAFF_ROLES = new Set(["SUPER_ADMIN", "CINEMA_MANAGER"]);

/** 200: orden pagada. 202: el banco pide autenticacion (3D Secure); el cliente debe completarla y luego confirmar. */
export async function pay(req: Request, res: Response): Promise<void> {
  const { provider, source } = req.body as PayOrderInput;
  const result = await paymentService.payOrder(req.params.id as string, req.user!.id, provider, source);
  if (result.action) {
    res.status(202).json({ order: result.order, action: result.action });
    return;
  }
  res.status(200).json({ order: result.order });
}

export async function confirm(req: Request, res: Response): Promise<void> {
  const { paymentIntentId } = req.body as ConfirmPaymentInput;
  const order = await paymentService.confirmPayment(req.params.id as string, req.user!.id, paymentIntentId);
  res.status(200).json({ order });
}

export async function checkoutSession(req: Request, res: Response): Promise<void> {
  const { provider } = req.body as CheckoutSessionInput;
  const session = await paymentService.createCheckoutSession(req.params.id as string, req.user!.id, provider);
  res.status(200).json({ session });
}

export async function refund(req: Request, res: Response): Promise<void> {
  const isStaff = STAFF_ROLES.has(req.user!.role);
  const order = await paymentService.refundOrder(req.params.id as string, req.user!.id, isStaff);
  res.status(200).json({ order });
}

/**
 * Configuracion publica de pagos para el checkout: moneda de la tienda, que proveedores estan disponibles
 * y, si PayPal cobra en otra moneda, en cual y a que tipo de cambio (para mostrarle al cliente lo que se le cobrara).
 * Solo datos publicos: el Client ID de PayPal esta pensado para el navegador; nunca se expone un secreto.
 */
export function config(_req: Request, res: Response): void {
  const paypalEnabled = Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);
  res.status(200).json({
    currency: env.PAYMENT_CURRENCY,
    stripe: {
      enabled: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PUBLISHABLE_KEY),
      publishableKey: env.STRIPE_PUBLISHABLE_KEY ?? null,
      currency: providerCurrency("STRIPE"),
      rate: providerRate("STRIPE"),
    },
    paypal: {
      enabled: paypalEnabled,
      clientId: paypalEnabled ? env.PAYPAL_CLIENT_ID : null,
      currency: providerCurrency("PAYPAL"),
      rate: providerRate("PAYPAL"),
    },
    loyalty: { pointsPerDiscountUnit: POINTS_PER_DISCOUNT_UNIT, maxRedeemShare: MAX_REDEEM_SHARE },
  });
}
