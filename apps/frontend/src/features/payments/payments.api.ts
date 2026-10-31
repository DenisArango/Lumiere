import { apiClient } from "@/lib/api-client";
import type { Order } from "@/features/bookings/bookings.types";

export type PaymentProvider = "STRIPE" | "PAYPAL";

export interface PaymentConfig {
  currency: string;
  stripe: { enabled: boolean; publishableKey: string | null; currency: string; rate: number | null };
  paypal: { enabled: boolean; clientId: string | null; currency: string; rate: number | null };
  loyalty: { pointsPerDiscountUnit: number; maxRedeemShare: number };
}

/** Accion que el navegador debe completar antes de que el cobro termine (3D Secure). */
export interface PendingAction {
  type: "stripe_3ds";
  clientSecret: string;
  paymentIntentId: string;
}

export interface PayResult {
  order: Order;
  action?: PendingAction;
}

export interface CheckoutSession {
  providerOrderId: string;
  chargedAmount: number;
  chargedCurrency: string;
}

export async function fetchPaymentConfig(): Promise<PaymentConfig> {
  const { data } = await apiClient.get<PaymentConfig>("/payments/config");
  return data;
}

/** 200 = pagada; 202 = el banco pide autenticacion (3D Secure) y hay que completarla antes de confirmar. */
export async function payOrder(orderId: string, provider: PaymentProvider, source: string): Promise<PayResult> {
  const { data } = await apiClient.post<{ order: Order; action?: PendingAction }>(`/orders/${orderId}/pay`, {
    provider,
    source,
  });
  return { order: data.order, action: data.action };
}

export async function confirmPayment(orderId: string, paymentIntentId: string): Promise<Order> {
  const { data } = await apiClient.post<{ order: Order }>(`/orders/${orderId}/pay/confirm`, { paymentIntentId });
  return data.order;
}

/** PayPal: la orden de PayPal la crea el servidor con el total de nuestra orden. */
export async function createCheckoutSession(orderId: string, provider: PaymentProvider): Promise<CheckoutSession> {
  const { data } = await apiClient.post<{ session: CheckoutSession }>(`/orders/${orderId}/checkout-session`, { provider });
  return data.session;
}
