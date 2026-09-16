import { useParams, Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { useShowtimes } from "@/features/showtimes/showtimes.hooks";
import { useMovie } from "@/features/movies/movies.hooks";
import { Button } from "@/components/ui/button";
import type { Showtime } from "@/features/showtimes/showtimes.types";

function groupByCinema(showtimes: Showtime[]): Map<string, Showtime[]> {
  const groups = new Map<string, Showtime[]>();
  for (const s of showtimes) {
    const key = `${s.room.cinema.name} · ${s.room.cinema.city}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return groups;
}

export function ShowtimesPage() {
  const { id } = useParams<{ id: string }>();
  const { data: movie } = useMovie(id);
  const { data, isLoading, isError } = useShowtimes({ movieId: id, pageSize: 50 });

  const groups = data ? groupByCinema(data.items) : new Map<string, Showtime[]>();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="text-sm text-ink-muted">Funciones para</p>
      <h1 className="font-display text-2xl italic text-ink">{movie?.title ?? "…"}</h1>

      {isLoading && <p className="mt-8 text-ink-muted">Cargando funciones…</p>}
      {isError && <p className="mt-8 text-danger">No pudimos cargar las funciones.</p>}

      {data && data.items.length === 0 && (
        <p className="mt-8 text-ink-muted">No hay funciones programadas para esta película por ahora.</p>
      )}

      <div className="mt-8 space-y-8">
        {Array.from(groups.entries()).map(([cinemaLabel, showtimes]) => (
          <div key={cinemaLabel}>
            <h2 className="font-display text-lg text-ink">{cinemaLabel}</h2>
            <p className="text-xs text-ink-muted">{showtimes[0]?.room.name}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {showtimes.map((s) => {
                const soldOut = s.availableSeats === 0;
                return (
                  <Button key={s.id} asChild={!soldOut} variant="outline" disabled={soldOut} className="h-auto flex-col items-start px-4 py-2">
                    {soldOut ? (
                      <span>
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <Clock className="size-3.5" />
                          {new Date(s.startTime).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="text-xs text-ink-muted">Agotado</span>
                      </span>
                    ) : (
                      <Link to={`/funciones/${s.id}/asientos`}>
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <Clock className="size-3.5" />
                          {new Date(s.startTime).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="text-xs text-ink-muted">
                          {s.format === "THREE_D" ? "3D" : "2D"} · ${s.basePrice} · {s.availableSeats} disponibles
                        </span>
                      </Link>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
