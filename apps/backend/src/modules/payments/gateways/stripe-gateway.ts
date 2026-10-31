import Stripe from "stripe";
import { env } from "@/config/env";
import { AppError } from "@/utils/app-error";
import { toProviderAmount } from "@/modules/payments/currency";
import type {
  ChargeParams,
  ChargeResult,
  ConfirmParams,
  PaymentGateway,
  RefundResult,
} from "@/modules/payments/payment-gateway";

/**
 * Implementacion real contra la API de Stripe, verificada end-to-end en modo
 * prueba (cobro, 3D Secure, reembolso) - ver docs/backend/11-usuarios-puntos-y-stripe.md.
 *
 * El cliente se instancia de forma perezosa (no al importar el modulo) para
 * que la app pueda arrancar sin la clave configurada mientras el proveedor
 * no se use realmente.
 */
export class StripeGateway implements PaymentGateway {
  private client: Stripe | undefined;

  private getClient(): Stripe {
    if (!env.STRIPE_SECRET_KEY) {
      throw new AppError("Stripe no está configurado (falta STRIPE_SECRET_KEY)", 503);
    }
    if (!this.client) {
      this.client = new Stripe(env.STRIPE_SECRET_KEY);
    }
    return this.client;
  }

  async charge(params: ChargeParams): Promise<ChargeResult> {
    const client = this.getClient();

    // La orden esta en la moneda de la tienda; Stripe cobra en la de la cuenta (ej. GTQ -> MXN).
    const charged = toProviderAmount("STRIPE", params.amount);
    const paymentIntent = await client.paymentIntents.create(
      {
        amount: Math.round(charged.value * 100),
        currency: charged.currency.toLowerCase(),
        payment_method: params.source,
        confirm: true,
        // La orden viaja como metadata: los webhooks y la verificacion tras 3D Secure la usan para reconciliar.
        metadata: { orderId: params.orderId },
        // "never": sin metodos con redireccion; el 3D Secure de tarjeta se completa en un modal, sin salir del sitio.
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      },
      // Reintentar con la misma tarjeta y orden no debe crear un segundo cobro.
      { idempotencyKey: `lumiere-charge-${params.orderId}-${params.source}` },
    );

    return this.toResult(paymentIntent);
  }

  /**
   * Tras completar 3D Secure en el navegador, el cliente avisa al backend. NO se confia en ese aviso:
   * se vuelve a consultar el PaymentIntent a Stripe y se comprueba que sea de esta orden y por el monto exacto.
   */
  async confirm(params: ConfirmParams): Promise<ChargeResult> {
    const client = this.getClient();
    const paymentIntent = await client.paymentIntents.retrieve(params.providerPaymentId);

    const sameOrder = paymentIntent.metadata?.orderId === params.orderId;
    const expected = toProviderAmount("STRIPE", params.amount);
    const sameAmount = paymentIntent.amount === Math.round(expected.value * 100);
    const sameCurrency = paymentIntent.currency === expected.currency.toLowerCase();
    if (!sameOrder || !sameAmount || !sameCurrency) {
      return { providerPaymentId: paymentIntent.id, status: "FAILED" };
    }

    return this.toResult(paymentIntent);
  }

  /**
   * Reembolso total sin monto: Stripe devuelve exactamente lo que cobro, en la moneda en que cobro. Pasar el monto de
   * la orden (en la moneda de la tienda) seria incorrecto cuando la cuenta cobra en otra moneda.
   */
  async refund(providerPaymentId: string): Promise<RefundResult> {
    const client = this.getClient();

    const refund = await client.refunds.create({ payment_intent: providerPaymentId });

    return {
      providerRefundId: refund.id,
      status: refund.status === "succeeded" ? "COMPLETED" : "FAILED",
    };
  }

  private toResult(paymentIntent: Stripe.PaymentIntent): ChargeResult {
    if (paymentIntent.status === "succeeded") {
      return { providerPaymentId: paymentIntent.id, status: "COMPLETED" };
    }
    if (paymentIntent.status === "requires_action" && paymentIntent.client_secret) {
      return {
        providerPaymentId: paymentIntent.id,
        status: "REQUIRES_ACTION",
        clientSecret: paymentIntent.client_secret,
      };
    }
    return { providerPaymentId: paymentIntent.id, status: "FAILED" };
  }
}
