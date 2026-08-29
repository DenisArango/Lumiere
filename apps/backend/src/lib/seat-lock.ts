import { redis } from "@/lib/redis";

const LOCK_PREFIX = "seatlock:";

function lockKey(showtimeSeatId: string): string {
  return `${LOCK_PREFIX}${showtimeSeatId}`;
}

/**
 * Bloqueo distribuido atomico vía Redis SET NX EX - ver docs/05-diagramas-uml.md
 * seccion "Compra de boletos con bloqueo de asiento". Es la puerta de
 * atomicidad ante solicitudes concurrentes; el estado durable/consultable
 * vive en la columna ShowtimeSeat.status (Postgres), que se actualiza
 * inmediatamente despues de ganar el lock en Redis.
 */
export async function acquireSeatLock(
  showtimeSeatId: string,
  userId: string,
  ttlSeconds: number,
): Promise<boolean> {
  const result = await redis.set(lockKey(showtimeSeatId), userId, "EX", ttlSeconds, "NX");
  return result === "OK";
}

export async function releaseSeatLockKey(showtimeSeatId: string): Promise<void> {
  await redis.del(lockKey(showtimeSeatId));
}
