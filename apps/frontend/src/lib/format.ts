/** Formateadores centralizados con Intl: un solo lugar para moneda y fechas en toda la app. */

/** Debe coincidir con PAYMENT_CURRENCY del backend: lo que se muestra es lo que se cobra. */
const CURRENCY = (import.meta.env.VITE_CURRENCY as string | undefined) ?? "GTQ";
const money = new Intl.NumberFormat("es-GT", { style: "currency", currency: CURRENCY });
const dateTime = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });
const date = new Intl.DateTimeFormat("es", { dateStyle: "medium" });
const number = new Intl.NumberFormat("es");

export function formatMoney(value: number | string): string {
  return money.format(Number(value));
}

export function formatDateTime(value: string | Date): string {
  return dateTime.format(new Date(value));
}

export function formatDate(value: string | Date): string {
  return date.format(new Date(value));
}

export function formatNumber(value: number): string {
  return number.format(value);
}

/** Iniciales para avatares: "Ana Lopez" -> "AL". */
export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
