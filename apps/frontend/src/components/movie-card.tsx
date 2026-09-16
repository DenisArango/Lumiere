import { useRef, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Film } from "lucide-react";
import type { MovieSummary } from "@/features/movies/movies.types";

/**
 * Tarjeta estilo stub de boleto: poster a sangre completa, linea de
 * perforacion, y el titulo debajo (no superpuesto en degradado sobre la
 * imagen - ese overlay es un patron muy comun de "tarjeta generica de app").
 * Spotlight que sigue el cursor (ver docs/00-brand-lumiere.md) + layoutId
 * compartido con la pagina de detalle.
 */
export function MovieCard({ movie, index }: { movie: MovieSummary; index: number }) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--x", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty("--y", `${((e.clientY - rect.top) / rect.height) * 100}%`);
  }

  return (
    <Link to={`/peliculas/${movie.id}`} className="group block">
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="border border-hairline bg-surface"
      >
        <div className="relative aspect-2/3 overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(280px circle at var(--x, 50%) var(--y, 50%), color-mix(in srgb, var(--lumiere-accent-gold) 25%, transparent), transparent 70%)",
            }}
          />
          <span className="reel-index absolute left-2 top-2 z-10 text-sm text-white/80" style={{ textShadow: "0 1px 4px rgb(0 0 0 / 0.6)" }}>
            {String(index + 1).padStart(2, "0")}
          </span>
          {movie.posterUrl ? (
            <motion.img
              layoutId={`poster-${movie.id}`}
              src={movie.posterUrl}
              alt={`Póster de ${movie.title}`}
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <motion.div layoutId={`poster-${movie.id}`} className="flex size-full items-center justify-center bg-elevated text-ink-muted">
              <Film className="size-10" />
            </motion.div>
          )}
        </div>

        {/* linea de perforacion tipo stub de boleto */}
        <div
          className="h-0 border-t border-dashed border-hairline"
          style={{ backgroundImage: "none" }}
          aria-hidden
        />

        <div className="px-3 py-2.5">
          <p className="eyebrow">
            {movie.rating.code} · {movie.durationMinutes} min
          </p>
          <p className="mt-1 line-clamp-2 font-display text-base italic leading-snug text-ink">{movie.title}</p>
        </div>
      </motion.div>
    </Link>
  );
}
