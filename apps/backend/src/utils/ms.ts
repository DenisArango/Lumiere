const UNIT_TO_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/**
 * Parser minimo de duraciones tipo "15m", "7d", "30s" a milisegundos.
 * Evita depender de un paquete externo solo para esto.
 */
export default function ms(duration: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Formato de duracion invalido: "${duration}" (ej. "15m", "7d")`);
  }
  const [, amount, unit] = match;
  const multiplier = UNIT_TO_MS[unit as string];
  if (amount === undefined || multiplier === undefined) {
    throw new Error(`Formato de duracion invalido: "${duration}" (ej. "15m", "7d")`);
  }
  return Number(amount) * multiplier;
}
