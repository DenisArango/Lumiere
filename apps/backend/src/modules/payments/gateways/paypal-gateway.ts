import {
  Client,
  Environment,
  OrdersController,
  PaymentsController,
  CheckoutPaymentIntent,
} from "@paypal/paypal-server-sdk";
import { env } from "@/config/env";
import { AppError } from "@/utils/app-error";
import type { ChargeParams, ChargeResult, PaymentGateway, RefundResult } from "@/modules/payments/payment-gateway";

/**
 * Implementacion real contra la API de PayPal (Orders v2). NO verificada
 * end-to-end en este entorno (requiere PAYPAL_CLIENT_ID/SECRET de una
 * cuenta sandbox real) - ver docs/backend/09-pagos.md. `source` es el ID de
 * la orden de PayPal ya aprobada por el comprador en el frontend (PayPal
 * SDK / Smart Buttons), no un dato de pago crudo.
 *
 * La forma de la API (OrdersController.ordersCapture, PaymentsController.
 * capturesRefund, campos de Money/RefundRequest) se verifico contra los
 * .d.ts reales del paquete instalado (no contra documentacion externa) -
 * compila y tipa correctamente. Lo unico que falta es la prueba de red
 * real contra el sandbox de PayPal, que requiere credenciales.
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

  async charge(params: ChargeParams): Promise<ChargeResult> {
    const client = this.getClient();
    const ordersController = new OrdersController(client);

    // `source` es el ID de una orden de PayPal ya creada/aprobada en el
    // frontend - aqui solo se captura el pago.
    const { result } = await ordersController.ordersCapture({ id: params.source });

    return {
      providerPaymentId: result.id ?? params.source,
      status: result.status === "COMPLETED" ? "COMPLETED" : "FAILED",
    };
  }

  async refund(providerPaymentId: string, amount: number): Promise<RefundResult> {
    const client = this.getClient();
    const paymentsController = new PaymentsController(client);

    const { result } = await paymentsController.capturesRefund({
      captureId: providerPaymentId,
      body: { amount: { value: amount.toFixed(2), currencyCode: "USD" } },
    });

    return {
      providerRefundId: result.id ?? providerPaymentId,
      status: result.status === "COMPLETED" ? "COMPLETED" : "FAILED",
    };
  }
}

/** Referenciado para dejar constancia del intent usado al crear ordenes desde el frontend (CAPTURE, no AUTHORIZE). */
export const PAYPAL_INTENT = CheckoutPaymentIntent.Capture;
