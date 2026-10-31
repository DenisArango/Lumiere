import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { MovieCard } from "@/components/movie-card";
import { Button } from "@/components/ui/button";
import { useMovies } from "@/features/movies/movies.hooks";
import type { MovieStatus, MovieSummary } from "@/features/movies/movies.types";
import { cn } from "@/lib/utils";

const TABS: { value: MovieStatus; label: string }[] = [
  { value: "IN_THEATERS", label: "En cartelera" },
  { value: "COMING_SOON", label: "Próximamente" },
];

/**
 * Marquesina: la pelicula destacada ocupa un tratamiento a sangre completa
 * con el titulo apoyado abajo-izquierda, como una entrada de cine real -
 * no el patron generico de heading centrado + boton centrado + blob de
 * gradiente detras (ver memoria sobre composicion).
 *
 * Sin imagen de fondo (backdrop) el hero no puede quedarse como un vacio
 * oscuro: el poster pasa a ser protagonista, enmarcado, y su propia
 * imagen desenfocada tine el fondo. El haz del proyector (el motivo de la
 * marca) cruza el hero en ambos casos.
 */
function Marquee({ movie }: { movie: MovieSummary }) {
  const hasBackdrop = Boolean(movie.backdropUrl);
  const showPoster = !hasBackdrop && Boolean(movie.posterUrl);

  return (
    <section className="relative overflow-hidden border-b border-hairline">
      <div className="absolute inset-0">
        {hasBackdrop ? (
          <img src={movie.backdropUrl ?? ""} alt="" className="size-full object-cover" />
        ) : (
          <>
            <div className="size-full bg-elevated" />
            {movie.posterUrl && (
              <img
                src={movie.posterUrl}
                alt=""
                aria-hidden
                className="absolute inset-0 size-full scale-125 object-cover opacity-25 blur-3xl"
              />
            )}
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-base via-base/70 to-base/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-base/60 via-transparent to-transparent" />
        <div className="projector-beam pointer-events-none absolute -right-10 -top-24 h-[150%] w-[75%]" aria-hidden />
      </div>

      <div
        className={cn(
          "relative mx-auto grid min-h-[60vh] max-w-6xl items-end gap-10 px-4 py-10 sm:px-6 sm:py-14",
          showPoster && "md:grid-cols-[1fr_290px]",
        )}
      >
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="max-w-3xl">
          <p className="eyebrow">Ahora en cartelera</p>
          <h1 className="mt-2 text-balance font-display text-4xl italic leading-[1.05] text-ink sm:text-5xl lg:text-6xl">{movie.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
            <span className="border border-hairline px-1.5 py-0.5 text-xs font-medium">{movie.rating.code}</span>
            <span>{movie.durationMinutes} min</span>
            {movie.genres[0] && <span>{movie.genres[0].name}</span>}
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={`/peliculas/${movie.id}/funciones`}>Ver funciones</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to={`/peliculas/${movie.id}`}>Más información</Link>
            </Button>
          </div>
        </motion.div>

        {showPoster && (
          <motion.div
            initial={{ opacity: 0, y: 24, rotate: 0 }}
            animate={{ opacity: 1, y: 0, rotate: 1.5 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="hidden aspect-2/3 w-full overflow-hidden border border-gold/60 bg-surface p-1.5 md:block"
          >
            <img
              src={movie.posterUrl ?? ""}
              alt={`Póster de ${movie.title}`}
              width={290}
              height={435}
              className="size-full object-cover"
            />
          </motion.div>
        )}
      </div>
    </section>
  );
}

function BrandIntro() {
  return (
    <section className="relative overflow-hidden border-b border-hairline">
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, var(--lumiere-accent-gold), transparent 70%)" }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <p className="eyebrow">Bienvenida a Lumière</p>
        <h1 className="mt-3 font-display text-3xl italic leading-tight text-ink sm:text-5xl">
          Donde nació la experiencia de ver historias en pantalla
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-ink-muted">
          Todavía no hay funciones publicadas. Vuelve pronto para elegir tu próxima función.
        </p>
      </div>
    </section>
  );
}

export function HomePage() {
  const [status, setStatus] = useState<MovieStatus>("IN_THEATERS");
  const { data, isLoading, isError } = useMovies({ status, pageSize: 24 });

  // La destacada es la primera con imagen (fondo o poster); si ninguna la tiene, la primera de la lista.
  const items = data?.items;
  const featured =
    status === "IN_THEATERS" && items
      ? (items.find((m) => m.backdropUrl) ?? items.find((m) => m.posterUrl) ?? items[0])
      : undefined;
  const rest = featured ? items?.filter((m) => m.id !== featured.id) : items;

  return (
    <div>
      {featured ? <Marquee movie={featured} /> : !isLoading && <BrandIntro />}

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-4">
          <div>
            <p className="eyebrow">La cartelera</p>
            <h2 className="mt-1 font-display text-2xl italic text-ink">
              {status === "IN_THEATERS" ? "Funciones disponibles" : "Estrenos por venir"}
            </h2>
          </div>
          <div className="flex items-center gap-1 border border-hairline">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatus(tab.value)}
                className={cn(
                  "px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
                  status === tab.value ? "bg-gold text-black" : "text-ink-muted hover:text-ink",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {isError && (
          <p className="border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            No pudimos cargar la cartelera. Intenta de nuevo en un momento.
          </p>
        )}

        {isLoading && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-2/3 animate-pulse border border-hairline bg-surface" />
            ))}
          </div>
        )}

        {rest && rest.length === 0 && (
          <p className="py-16 text-center text-ink-muted">
            No hay películas {status === "IN_THEATERS" ? "en cartelera" : "próximamente"} por ahora.
          </p>
        )}

        {rest && rest.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {rest.map((movie, i) => (
              <MovieCard key={movie.id} movie={movie} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
