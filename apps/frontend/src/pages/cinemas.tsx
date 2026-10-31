import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Film, MapPin, Phone } from "lucide-react";
import { useCinemas } from "@/features/cinemas/cinemas.hooks";
import { useShowtimes } from "@/features/showtimes/showtimes.hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function CinemasPage() {
  const { data, isLoading, isError } = useCinemas();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Solo funciones vigentes de ESE cine: la API ya oculta canceladas y las que ya comenzaron.
  const { data: showtimes, isLoading: loadingMovies } = useShowtimes({ cinemaId: selectedId ?? undefined, pageSize: 50 });
  const selected = data?.items.find((c) => c.id === selectedId);

  const movies = useMemo(() => {
    const byMovie = new Map<string, { id: string; title: string; posterUrl: string | null; count: number; next: string }>();
    for (const s of showtimes?.items ?? []) {
      const found = byMovie.get(s.movie.id);
      if (found) found.count += 1;
      else byMovie.set(s.movie.id, { id: s.movie.id, title: s.movie.title, posterUrl: s.movie.posterUrl, count: 1, next: s.startTime });
    }
    return [...byMovie.values()];
  }, [showtimes]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Ubicaciones</p>
      <h1 className="mt-1 font-display text-3xl italic text-ink">Nuestros cines</h1>
      <p className="mt-1 text-sm text-ink-muted">Elige un cine para ver qué películas tienen función disponible ahí.</p>

      {isLoading && <p className="mt-8 text-ink-muted">Cargando…</p>}
      {isError && <p className="mt-8 text-danger">No pudimos cargar los cines.</p>}

      {data && data.items.length === 0 && <p className="mt-8 text-ink-muted">Todavía no hay cines registrados.</p>}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {data?.items.map((cinema) => (
          <button
            key={cinema.id}
            type="button"
            aria-pressed={selectedId === cinema.id}
            onClick={() => setSelectedId(selectedId === cinema.id ? null : cinema.id)}
            className="text-left"
          >
            <Card className={cn("h-full transition-colors hover:border-gold", selectedId === cinema.id && "border-gold")}>
              <CardHeader>
                <CardTitle>{cinema.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-ink-muted">
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0" />
                  {cinema.address}, {cinema.city}, {cinema.state}
                </p>
                {cinema.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="size-4 shrink-0" /> {cinema.phone}
                  </p>
                )}
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {selected && (
        <section className="mt-10" aria-live="polite">
          <p className="eyebrow">En cartelera</p>
          <h2 className="mt-1 font-display text-2xl italic text-ink">{selected.name}</h2>

          {loadingMovies && <p className="mt-4 text-sm text-ink-muted">Buscando funciones…</p>}
          {!loadingMovies && movies.length === 0 && (
            <p className="mt-4 text-sm text-ink-muted">Este cine no tiene funciones disponibles por ahora.</p>
          )}

          <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4">
            {movies.map((movie) => (
              <li key={movie.id}>
                <Link to={`/peliculas/${movie.id}/funciones`} className="group block">
                  <div className="aspect-2/3 overflow-hidden border border-hairline bg-surface transition-colors group-hover:border-gold">
                    {movie.posterUrl ? (
                      <img src={movie.posterUrl} alt={`Póster de ${movie.title}`} loading="lazy" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-ink-muted">
                        <Film className="size-8" />
                      </div>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 font-display italic text-ink group-hover:text-gold">{movie.title}</p>
                  <p className="text-xs text-ink-muted">
                    {movie.count} {movie.count === 1 ? "función" : "funciones"} · próxima {formatDateTime(movie.next)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
