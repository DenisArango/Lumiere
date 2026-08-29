/**
 * Patron Strategy para procesadores de pago - ver diagrama de clases en
 * docs/05-diagramas-uml.md seccion 2. El resto del modulo de pagos depende
 * unicamente de esta interfaz, nunca de Stripe o PayPal directamente, para
 * poder agregar un tercer proveedor (o sustituir por un gateway simulado
 * en tests) sin tocar la logica de ordenes.
 */
export interface ChargeParams {
  amount: number;
  currency: string;
  /** Token de metodo de pago ya tokenizado por el proveedor en el frontend (Stripe Elements / PayPal SDK) - nunca un numero de tarjeta crudo. */
  source: string;
}

export interface ChargeResult {
  providerPaymentId: string;
  status: "COMPLETED" | "FAILED";
}

export interface RefundResult {
  providerRefundId: string;
  status: "COMPLETED" | "FAILED";
}

export interface PaymentGateway {
  charge(params: ChargeParams): Promise<ChargeResult>;
  refund(providerPaymentId: string, amount: number): Promise<RefundResult>;
}
