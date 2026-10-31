/**
 * Programa de puntos: 1 punto por cada unidad entera pagada. Vive en un
 * solo lugar para que el cobro (payment.service) y el panel muestren la
 * misma regla. Los puntos se guardan en Order.pointsEarned al pagar, asi
 * un reembolso revierte exactamente lo que se otorgo, aunque la regla
 * cambie despues.
 */
export const LOYALTY_POINTS_PER_CURRENCY_UNIT = 1;

export function pointsForAmount(totalAmount: number): number {
  return Math.floor(totalAmount) * LOYALTY_POINTS_PER_CURRENCY_UNIT;
}

/** Canje: 10 puntos = 1 unidad de moneda de descuento (devuelve un 10 % de lo gastado). */
export const POINTS_PER_DISCOUNT_UNIT = 10;

/** Un canje puede cubrir como maximo la mitad de lo que se paga: evita ordenes de total 0 (los cobros minimos fallan). */
export const MAX_REDEEM_SHARE = 0.5;

/** Unidades de descuento que se pueden canjear: lo que alcanzan los puntos, con tope en la mitad del total. */
export function redeemableDiscountUnits(pointsBalance: number, payableAmount: number): number {
  return Math.max(
    0,
    Math.min(Math.floor(pointsBalance / POINTS_PER_DISCOUNT_UNIT), Math.floor(payableAmount * MAX_REDEEM_SHARE)),
  );
}
