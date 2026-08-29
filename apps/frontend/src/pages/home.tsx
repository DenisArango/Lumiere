import { useState } from "react";
import { motion } from "motion/react";
import { MovieCard } from "@/components/movie-card";
import { useMovies } from "@/features/movies/movies.hooks";
import type { MovieStatus } from "@/features/movies/movies.types";
import { cn } from "@/lib/utils";

const TABS: { value: MovieStatus; label: string }[] = [
  { value: "IN_THEATERS", label: "En cartelera" },
  { value: "COMING_SOON", label: "Próximamente" },
];

export function HomePage() {
  const [status, setStatus] = useState<MovieStatus>("IN_THEATERS");
  const { data, isLoading, isError } = useMovies({ status, pageSize: 24 });

  return (
    <div>
      {/* Hero: vineta + haz de luz, ver docs/00-brand-lumiere.md seccion 5 */}
      <section className="relative overflow-hidden border-b border-hairline">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% -10%, color-mix(in srgb, var(--lumiere-accent-gold) 18%, transparent), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-display text-4xl italic tracking-tight text-ink sm:text-6xl"
          >
            Donde nació la experiencia
            <br /> de ver historias en pantalla
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-4 max-w-xl text-ink-muted"
          >
            Elige tu función, elige tu butaca, sin sorpresas de último minuto.
          </motion.p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center gap-1 rounded-full border border-hairline bg-surface p-1 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                status === tab.value ? "bg-gold text-black" : "text-ink-muted hover:text-ink",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isError && (
          <p className="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            No pudimos cargar la cartelera. Intenta de nuevo en un momento.
          </p>
        )}

        {isLoading && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-2/3 animate-pulse rounded-lg bg-surface" />
            ))}
          </div>
        )}

        {data && data.items.length === 0 && (
          <p className="py-16 text-center text-ink-muted">
            No hay películas {status === "IN_THEATERS" ? "en cartelera" : "próximamente"} por ahora.
          </p>
        )}

        {data && data.items.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {data.items.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
