import Stripe from "stripe";
import { env } from "@/config/env";
import { AppError } from "@/utils/app-error";
import type { ChargeParams, ChargeResult, PaymentGateway, RefundResult } from "@/modules/payments/payment-gateway";

/**
 * Implementacion real contra la API de Stripe. La forma de los parametros
 * (PaymentIntentCreateParams, RefundCreateParams) se verifico contra los
 * .d.ts reales del paquete `stripe` instalado - compila y tipa
 * correctamente. NO verificada end-to-end contra la red real de Stripe en
 * este entorno (requiere STRIPE_SECRET_KEY de una cuenta sandbox real) -
 * ver docs/backend/09-pagos.md seccion de deuda tecnica. El cliente se
 * instancia de forma perezosa (no al importar el modulo) para que la app
 * pueda arrancar sin la clave configurada mientras el proveedor no se use
 * realmente.
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

    const paymentIntent = await client.paymentIntents.create({
      amount: Math.round(params.amount * 100),
      currency: params.currency.toLowerCase(),
      payment_method: params.source,
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    });

    return {
      providerPaymentId: paymentIntent.id,
      status: paymentIntent.status === "succeeded" ? "COMPLETED" : "FAILED",
    };
  }

  async refund(providerPaymentId: string, amount: number): Promise<RefundResult> {
    const client = this.getClient();

    const refund = await client.refunds.create({
      payment_intent: providerPaymentId,
      amount: Math.round(amount * 100),
    });

    return {
      providerRefundId: refund.id,
      status: refund.status === "succeeded" ? "COMPLETED" : "FAILED",
    };
  }
}
