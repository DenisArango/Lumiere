import { useRef, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Film } from "lucide-react";
import type { MovieSummary } from "@/features/movies/movies.types";

/**
 * Spotlight que sigue el cursor sobre el poster (ver docs/00-brand-lumiere.md
 * seccion 5) - un gradiente radial posicionado con variables CSS, no una
 * libreria aparte. layoutId comparte la animacion del poster con la pagina
 * de detalle (transicion "shared element" de Framer Motion / motion).
 */
export function MovieCard({ movie }: { movie: MovieSummary }) {
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
        whileHover={{ scale: 1.03 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="relative aspect-2/3 overflow-hidden rounded-lg border border-hairline bg-surface"
      >
        <div
          className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(280px circle at var(--x, 50%) var(--y, 50%), color-mix(in srgb, var(--lumiere-accent-gold) 25%, transparent), transparent 70%)",
          }}
        />
        {movie.posterUrl ? (
          <motion.img
            layoutId={`poster-${movie.id}`}
            src={movie.posterUrl}
            alt={`Póster de ${movie.title}`}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <motion.div
            layoutId={`poster-${movie.id}`}
            className="flex size-full items-center justify-center bg-elevated text-ink-muted"
          >
            <Film className="size-10" />
          </motion.div>
        )}
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-10">
          <p className="line-clamp-2 font-display text-sm font-medium text-white">{movie.title}</p>
          <p className="mt-1 text-xs text-white/70">
            {movie.rating.code} · {movie.durationMinutes} min
          </p>
        </div>
      </motion.div>
    </Link>
  );
}
