import { loadStripe, type Stripe } from "@stripe/stripe-js";

/**
 * La clave PUBLICABLE de Stripe (pk_...) la entrega el backend en tiempo de ejecucion (GET /payments/config), no se
 * hornea al compilar: asi el mismo build sirve para pruebas y produccion, y en Render basta configurar una variable
 * del servidor. La clave secreta (sk_...) vive solo en el backend.
 *
 * Stripe.js no debe recargarse en cada render: se guarda una promesa por clave.
 */
const cache = new Map<string, Promise<Stripe | null>>();

export function getStripe(publishableKey: string): Promise<Stripe | null> {
  let promise = cache.get(publishableKey);
  if (!promise) {
    promise = loadStripe(publishableKey);
    cache.set(publishableKey, promise);
  }
  return promise;
}

/** Las claves de prueba empiezan con pk_test_: en ese modo se muestra la tarjeta de ejemplo y no se cobra dinero real. */
export function isTestKey(publishableKey: string | null | undefined): boolean {
  return publishableKey?.startsWith("pk_test_") ?? false;
}
