import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { Clapperboard, Film, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePerson } from "@/features/people/people.hooks";
import type { FilmographyMovie } from "@/features/people/people.types";
import { formatDate } from "@/lib/format";

function FilmStrip({ title, movies }: { title: string; movies: (FilmographyMovie & { characterName?: string | null })[] }) {
  if (movies.length === 0) return null;

  return (
    <section className="border-t border-hairline pt-6">
      <h2 className="eyebrow">{title}</h2>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-5">
        {movies.map((movie, index) => (
          <motion.li
            key={movie.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04 }}
          >
            <Link to={`/peliculas/${movie.id}`} className="group block">
              <div className="aspect-2/3 overflow-hidden border border-hairline bg-surface transition-colors group-hover:border-gold">
                {movie.posterUrl ? (
                  <img
                    src={movie.posterUrl}
                    alt={`Póster de ${movie.title}`}
                    width={300}
                    height={450}
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-ink-muted">
                    <Film className="size-8" />
                  </div>
                )}
              </div>
              <p className="mt-2 truncate font-display italic text-ink group-hover:text-gold">{movie.title}</p>
              <p className="text-xs text-ink-muted">
                {movie.releaseYear}
                {movie.characterName ? ` · como ${movie.characterName}` : ""}
              </p>
            </Link>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

export function PersonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: person, isLoading, isError } = usePerson(id);

  if (isLoading) {
    return <div className="mx-auto max-w-5xl px-4 py-16 text-center text-ink-muted sm:px-6">Cargando…</div>;
  }

  if (isError || !person) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6">
        <p className="text-ink-muted">No pudimos encontrar a esta persona.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/">Volver a la cartelera</Link>
        </Button>
      </div>
    );
  }

  const { asDirector, asActor } = person.movieCounts;
  const total = asDirector + asActor;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6 md:py-14">
      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <div className="aspect-3/4 overflow-hidden border border-hairline bg-surface">
          {person.photoUrl ? (
            <img
              src={person.photoUrl}
              alt={`Foto de ${person.firstName} ${person.lastName}`}
              width={440}
              height={587}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-ink-muted">
              <UserRound className="size-14" />
            </div>
          )}
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <p className="eyebrow">
            {asDirector > 0 && asActor > 0 ? "Director y actor" : asDirector > 0 ? "Director" : asActor > 0 ? "Actor" : "Cine"}
          </p>
          <h1 className="mt-2 font-display text-4xl italic text-ink sm:text-5xl">
            {person.firstName} {person.lastName}
          </h1>

          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {person.nationality && (
              <div>
                <dt className="eyebrow">Nacionalidad</dt>
                <dd className="mt-1 text-ink">{person.nationality}</dd>
              </div>
            )}
            {person.birthDate && (
              <div>
                <dt className="eyebrow">Nacimiento</dt>
                <dd className="mt-1 text-ink">{formatDate(person.birthDate)}</dd>
              </div>
            )}
            <div>
              <dt className="eyebrow">En Lumière</dt>
              <dd className="mt-1 flex items-center gap-1.5 text-ink">
                <Clapperboard className="size-4 text-gold" />
                {total} {total === 1 ? "película" : "películas"}
                {total > 0 && (
                  <span className="text-ink-muted">
                    ({asDirector} dirigidas · {asActor} como actor)
                  </span>
                )}
              </dd>
            </div>
          </dl>

          {person.bio ? (
            <p className="mt-6 max-w-2xl leading-relaxed text-ink">{person.bio}</p>
          ) : (
            <p className="mt-6 text-sm text-ink-muted">Todavía no tenemos una biografía de esta persona.</p>
          )}
        </motion.div>
      </div>

      <FilmStrip title="Dirigidas" movies={person.filmography.asDirector} />
      <FilmStrip title="Como actor" movies={person.filmography.asActor} />
    </div>
  );
}
