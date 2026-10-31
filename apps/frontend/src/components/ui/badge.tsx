import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  gold: "border-gold/60 text-gold",
  success: "border-success/60 text-success",
  danger: "border-danger/60 text-danger",
  muted: "border-hairline text-ink-muted",
} as const;

export type BadgeTone = keyof typeof TONES;

/** Etiqueta de estado: el texto siempre dice el estado, el color solo lo refuerza. */
export function Badge({ tone = "muted", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center border px-2 py-0.5 text-[0.8125rem] font-semibold uppercase tracking-[0.1em]",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
