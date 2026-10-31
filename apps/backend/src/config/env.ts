import { z } from "zod";

/**
 * Todas las variables de entorno requeridas se validan aqui, al arranque.
 * Si falta o es invalida una variable, el proceso falla rapido con un
 * mensaje claro en vez de fallar silenciosamente en produccion.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().url(),

  REDIS_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET debe tener al menos 32 caracteres"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET debe tener al menos 32 caracteres"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  /**
   * Saltos de proxy delante de la app (Render pone un balanceador). Express lo usa para leer la IP real del
   * cliente (rate limit, bitacora). Si es mayor al real, un cliente podria falsear su IP; si es menor, todos
   * compartirian la IP del proxy.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),

  /** Carpeta del frontend compilado. Si se define, el backend lo sirve (un solo servicio para API + sitio). */
  FRONTEND_DIST: z.string().optional(),

  COOKIE_DOMAIN: z.string().optional(),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  /** Moneda ISO-4217 con la que se cobra. Debe coincidir con la que muestra el frontend (VITE_CURRENCY). */
  PAYMENT_CURRENCY: z.string().trim().length(3).toUpperCase().default("GTQ"),
  /**
   * Moneda en la que COBRA Stripe segun tu cuenta (ej. MXN). Si difiere de PAYMENT_CURRENCY, el monto se
   * convierte con STRIPE_RATE = unidades de PAYMENT_CURRENCY por 1 unidad de STRIPE_CURRENCY (ej. 0.42 GTQ por 1 MXN).
   * Si no se define, Stripe cobra en PAYMENT_CURRENCY.
   */
  STRIPE_CURRENCY: z.string().trim().length(3).toUpperCase().optional(),
  STRIPE_RATE: z.coerce.number().positive().optional(),
  /** Clave PUBLICABLE (pk_...): segura de exponer; se entrega al navegador por /payments/config en tiempo de ejecucion. */
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_ENV: z.enum(["sandbox", "live"]).default("sandbox"),
  /** ID del webhook registrado en el panel de PayPal; sin el no se pueden verificar sus eventos. */
  PAYPAL_WEBHOOK_ID: z.string().optional(),
  /**
   * PayPal no soporta todas las monedas (por ejemplo GTQ). Si PAYPAL_CURRENCY difiere de
   * PAYMENT_CURRENCY, el monto se convierte con PAYPAL_RATE = unidades de PAYMENT_CURRENCY
   * por 1 unidad de PAYPAL_CURRENCY (ej. 7.7 GTQ por 1 USD).
   */
  PAYPAL_CURRENCY: z.string().trim().length(3).toUpperCase().default("USD"),
  PAYPAL_RATE: z.coerce.number().positive().optional(),

  SEAT_LOCK_TTL_SECONDS: z.coerce.number().int().positive().default(480),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("Variables de entorno invalidas o faltantes:");
    // eslint-disable-next-line no-console
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === "production";
