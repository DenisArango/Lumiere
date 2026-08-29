import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * Wordmark de Lumiere: el punto dorado con resplandor evoca el lente del
 * cinematografo / el haz de luz del proyector - ver docs/00-brand-lumiere.md
 * seccion "Motivos visuales". Deliberadamente no es un icono de claqueta o
 * palomitas (cliches de "app de cine generica" que la marca evita).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("group flex items-center gap-2.5", className)}>
      <span className="relative flex size-2.5 items-center justify-center">
        <span className="absolute size-2.5 rounded-full bg-gold blur-[6px] opacity-70 transition-opacity group-hover:opacity-100" />
        <span className="relative size-1.5 rounded-full bg-gold-bright" />
      </span>
      <span className="font-display text-xl italic tracking-tight text-ink">Lumière</span>
    </Link>
  );
}
