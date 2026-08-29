import { useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import { Film, Star, Clock, Globe2 } from "lucide-react";
import { useMovie } from "@/features/movies/movies.hooks";
import { Button } from "@/components/ui/button";

export function MovieDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: movie, isLoading, isError } = useMovie(id);

  if (isLoading) {
    return <div className="mx-auto max-w-5xl px-4 py-16 text-center text-ink-muted sm:px-6">Cargando…</div>;
  }

  if (isError || !movie) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6">
        <p className="text-ink-muted">No pudimos encontrar esta película.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/">Volver a la cartelera</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative border-b border-hairline">
        {movie.backdropUrl && (
          <div className="absolute inset-0">
            <img src={movie.backdropUrl} alt="" className="size-full object-cover opacity-25" />
            <div className="absolute inset-0 bg-gradient-to-t from-base via-base/80 to-base/40" />
          </div>
        )}

        <div className="relative mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[280px_1fr] md:py-16">
          <motion.div layoutId={`poster-${movie.id}`} className="aspect-2/3 overflow-hidden rounded-lg border border-hairline bg-surface">
            {movie.posterUrl ? (
              <img src={movie.posterUrl} alt={`Póster de ${movie.title}`} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-ink-muted">
                <Film className="size-10" />
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="flex flex-wrap gap-2">
              {movie.genres.map((g) => (
                <span key={g.id} className="rounded-full border border-hairline px-2.5 py-0.5 text-xs text-ink-muted">
                  {g.name}
                </span>
              ))}
            </div>

            <h1 className="mt-3 font-display text-3xl italic text-ink sm:text-4xl">{movie.title}</h1>
            {movie.originalTitle && movie.originalTitle !== movie.title && (
              <p className="mt-1 text-sm text-ink-muted">Título original: {movie.originalTitle}</p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-ink-muted">
              <span className="flex items-center gap-1.5">
                <Clock className="size-4" /> {movie.durationMinutes} min
              </span>
              <span className="flex items-center gap-1.5">
                <Globe2 className="size-4" /> {movie.originalLanguage.name}
              </span>
              <span className="rounded border border-hairline px-1.5 py-0.5 text-xs font-medium">
                {movie.rating.code}
              </span>
              {movie.averageRating !== null && (
                <span className="flex items-center gap-1.5 text-gold">
                  <Star className="size-4 fill-current" /> {movie.averageRating.toFixed(1)}
                  <span className="text-ink-muted">({movie.reviewCount})</span>
                </span>
              )}
            </div>

            <p className="mt-6 max-w-2xl leading-relaxed text-ink">{movie.synopsis}</p>

            <Button size="lg" className="mt-8" asChild>
              <Link to={`/peliculas/${movie.id}/funciones`}>Ver funciones</Link>
            </Button>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {movie.directors.length > 0 && (
          <div className="mb-8">
            <h2 className="font-display text-lg text-ink">Dirección</h2>
            <p className="mt-2 text-sm text-ink-muted">
              {movie.directors.map((d) => `${d.firstName} ${d.lastName}`).join(", ")}
            </p>
          </div>
        )}

        {movie.cast.length > 0 && (
          <div>
            <h2 className="font-display text-lg text-ink">Reparto</h2>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
              {movie.cast.map((actor) => (
                <span key={actor.id}>
                  {actor.firstName} {actor.lastName}
                  {actor.characterName ? ` como ${actor.characterName}` : ""}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
