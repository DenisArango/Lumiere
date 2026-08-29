import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "@/lib/redis";
import { env } from "@/config/env";

/**
 * Fabrica de rate limiters respaldados por Redis (para que el limite se
 * respete a traves de multiples instancias del backend, no solo en memoria
 * de un proceso). Ver docs/06-seguridad.md - los endpoints de auth y pagos
 * usan limites mas estrictos que las lecturas publicas.
 */
export function createRateLimiter(options: { windowMs: number; max: number; prefix: string }) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    // En tests de integracion se hacen decenas de logins/registros reales
    // contra la app en minutos - el limite existe para trafico real, no
    // para la suite de tests. Se desactiva solo cuando NODE_ENV=test.
    skip: () => env.NODE_ENV === "test",
    store: new RedisStore({
      // @ts-expect-error - firma de sendCommand de ioredis es compatible en runtime
      sendCommand: (...args: string[]) => redis.call(...args),
      prefix: `rl:${options.prefix}:`,
    }),
    message: { error: { message: "Demasiadas solicitudes, intenta de nuevo mas tarde" } },
  });
}

/** Limite general para toda la API publica. */
export const globalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  prefix: "global",
});

/** Limite estricto para endpoints de autenticacion (login, registro). */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  prefix: "auth",
});

/** Limite estricto para endpoints de pago. */
export const paymentRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  prefix: "payment",
});
