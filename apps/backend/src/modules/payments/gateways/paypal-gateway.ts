import {
  Client,
  Environment,
  OrdersController,
  PaymentsController,
  CheckoutPaymentIntent,
} from "@paypal/paypal-server-sdk";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { AppError } from "@/utils/app-error";
import { toProviderAmount } from "@/modules/payments/currency";
import type {
  ChargeParams,
  ChargeResult,
  CheckoutSession,
  CheckoutSessionParams,
  PaymentGateway,
  RefundResult,
} from "@/modules/payments/payment-gateway";

/** Monto en la moneda de PayPal como cadena con 2 decimales (el formato que exige su API). */
export function toPayPalAmount(amount: number): { value: string; currency: string } {
  const charged = toProviderAmount("PAYPAL", amount);
  return { value: charged.value.toFixed(2), currency: charged.currency };
}

/**
 * Implementacion real contra la API de PayPal (Orders v2).
 *
 * Seguridad del monto: la orden de PayPal se crea AQUI (createCheckoutSession) con el total de nuestra
 * orden y su id en `custom_id`. Al capturar se vuelve a consultar y se verifica que sea esa orden y ese
 * monto; asi un cliente no puede pagar con una orden de PayPal de otro valor creada por su cuenta.
 *
 * `providerPaymentId` es el id de la CAPTURA (no de la orden de PayPal): es el que exige el reembolso.
 */
export class PayPalGateway implements PaymentGateway {
  private client: Client | undefined;

  private getClient(): Client {
    if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
      throw new AppError("PayPal no está configurado (falta PAYPAL_CLIENT_ID/SECRET)", 503);
    }
    if (!this.client) {
      this.client = new Client({
        clientCredentialsAuthCredentials: {
          oAuthClientId: env.PAYPAL_CLIENT_ID,
          oAuthClientSecret: env.PAYPAL_CLIENT_SECRET,
        },
        environment: env.PAYPAL_ENV === "live" ? Environment.Production : Environment.Sandbox,
      });
    }
    return this.client;
  }

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSession> {
    const orders = new OrdersController(this.getClient());
    const charged = toPayPalAmount(params.amount);

    const { result } = await orders.ordersCreate({
      body: {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [
          {
            customId: params.orderId,
            description: "Lumière: boletos y dulcería",
            amount: { currencyCode: charged.currency, value: charged.value },
          },
        ],
      },
      prefer: "return=minimal",
    });

    if (!result.id) {
      throw new AppError("PayPal no devolvió el id de la orden", 502);
    }
    return { providerOrderId: result.id, chargedAmount: Number(charged.value), chargedCurrency: charged.currency };
  }

  async charge(params: ChargeParams): Promise<ChargeResult> {
    const orders = new OrdersController(this.getClient());
    const expected = toPayPalAmount(params.amount);

    // 1) Verificar ANTES de capturar: que la orden de PayPal sea de esta orden y por este monto.
    const { result: existing } = await orders.ordersGet({ id: params.source });
    const unit = existing.purchaseUnits?.[0];
    const sameOrder = unit?.customId === params.orderId;
    const sameAmount = unit?.amount?.value === expected.value && unit?.amount?.currencyCode === expected.currency;
    if (!sameOrder || !sameAmount) {
      logger.warn({ orderId: params.orderId, paypalOrder: params.source }, "Orden de PayPal no coincide con la orden; no se captura");
      return { providerPaymentId: params.source, status: "FAILED" };
    }

    // 2) Capturar.
    const { result } = await orders.ordersCapture({ id: params.source });
    const capture = result.purchaseUnits?.[0]?.payments?.captures?.[0];
    if (!capture?.id) {
      return { providerPaymentId: params.source, status: "FAILED" };
    }

    return {
      providerPaymentId: capture.id,
      status: result.status === "COMPLETED" && capture.status === "COMPLETED" ? "COMPLETED" : "FAILED",
    };
  }

  /** Reembolso total de la captura (sin monto: PayPal devuelve todo en la moneda en que cobro, sin convertir). */
  async refund(providerPaymentId: string): Promise<RefundResult> {
    const payments = new PaymentsController(this.getClient());
    const { result } = await payments.capturesRefund({
      captureId: providerPaymentId,
      body: { noteToPayer: "Reembolso de tu compra en Lumière" },
    });

    return {
      providerRefundId: result.id ?? providerPaymentId,
      status: result.status === "COMPLETED" ? "COMPLETED" : "FAILED",
    };
  }
}
