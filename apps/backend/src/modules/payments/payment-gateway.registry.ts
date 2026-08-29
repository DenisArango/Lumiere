import type { PaymentProvider } from "@prisma/client";
import type { PaymentGateway } from "@/modules/payments/payment-gateway";
import { StripeGateway } from "@/modules/payments/gateways/stripe-gateway";
import { PayPalGateway } from "@/modules/payments/gateways/paypal-gateway";

/**
 * Registro mutable (no un mapa constante congelado) a proposito: los tests
 * de integracion sustituyen `paymentGateways.STRIPE`/`PAYPAL` por un
 * gateway simulado antes de ejercitar la app real via supertest, para
 * probar toda la maquina de estados de la orden (PENDING -> PAID, butacas
 * SOLD, liberacion de locks, eventos de socket) sin depender de red ni de
 * credenciales reales - ver docs/backend/09-pagos.md.
 */
export const paymentGateways: Record<PaymentProvider, PaymentGateway> = {
  STRIPE: new StripeGateway(),
  PAYPAL: new PayPalGateway(),
};
