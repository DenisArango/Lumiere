/**
 * Patron Strategy para procesadores de pago - ver diagrama de clases en
 * docs/05-diagramas-uml.md seccion 2. El resto del modulo de pagos depende
 * unicamente de esta interfaz, nunca de Stripe o PayPal directamente, para
 * poder agregar un tercer proveedor (o sustituir por un gateway simulado
 * en tests) sin tocar la logica de ordenes.
 */
export interface ChargeParams {
  /** Monto en la moneda de la app (PAYMENT_CURRENCY). Cada gateway convierte si su proveedor lo necesita. */
  amount: number;
  currency: string;
  /** Token de metodo de pago ya tokenizado por el proveedor en el frontend (Stripe PaymentMethod / PayPal order id aprobada) - nunca un numero de tarjeta crudo. */
  source: string;
  /** La orden que se paga: viaja como metadata al proveedor para poder reconciliar webhooks y verificar capturas. */
  orderId: string;
}

export interface ChargeResult {
  /** Id con el que se reembolsa despues: PaymentIntent (Stripe) o id de la CAPTURA (PayPal). */
  providerPaymentId: string;
  /** REQUIRES_ACTION: el banco pide autenticacion (3D Secure); el cliente debe completarla en el navegador. */
  status: "COMPLETED" | "FAILED" | "REQUIRES_ACTION";
  clientSecret?: string;
}

export interface RefundResult {
  providerRefundId: string;
  status: "COMPLETED" | "FAILED";
}

export interface ConfirmParams {
  providerPaymentId: string;
  orderId: string;
  amount: number;
  currency: string;
}

export interface CheckoutSessionParams {
  orderId: string;
  amount: number;
  currency: string;
}

export interface CheckoutSession {
  providerOrderId: string;
  /** Lo que realmente se cobra en el proveedor (puede diferir de la moneda de la app). */
  chargedAmount: number;
  chargedCurrency: string;
}

export interface PaymentGateway {
  charge(params: ChargeParams): Promise<ChargeResult>;
  refund(providerPaymentId: string, amount: number): Promise<RefundResult>;
  /** Stripe: verifica un PaymentIntent tras completar 3D Secure en el navegador. */
  confirm?(params: ConfirmParams): Promise<ChargeResult>;
  /** PayPal: crea la orden en el servidor, con el monto fijado por nosotros (nunca por el cliente). */
  createCheckoutSession?(params: CheckoutSessionParams): Promise<CheckoutSession>;
}
