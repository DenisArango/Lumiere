
import { useParams, Link } from "react-router-dom";
import { Clock, CalendarDays, MapPin, Armchair } from "lucide-react";

import { useShowtimes } from "@/features/showtimes/showtimes.hooks";
import { useMovie } from "@/features/movies/movies.hooks";
import { Button } from "@/components/ui/button";

import type { Showtime } from "@/features/showtimes/showtimes.types";

const TIME_ZONE = "America/Guatemala";

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateLabelFormatter = new Intl.DateTimeFormat("es-GT", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("es-GT", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const priceFormatter = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function groupShowtimes(showtimes: Showtime[]) {
  const groups = new Map<
    string,
    Map<string, Showtime[]>
  >();

  // Ordenar las funciones por fecha y hora.
  const sorted = [...showtimes].sort(
    (a, b) =>
      new Date(a.startTime).getTime() -
      new Date(b.startTime).getTime()
  );

  // Evitar mostrar dos veces la misma función por ID.
  const seen = new Set<string>();

  for (const showtime of sorted) {
    if (seen.has(showtime.id)) continue;
    seen.add(showtime.id);

    const cinemaLabel =
      `${showtime.room.cinema.name} · ` +
      `${showtime.room.cinema.city}`;

    const dateKey = dateKeyFormatter.format(
      new Date(showtime.startTime)
    );

    if (!groups.has(cinemaLabel)) {
      groups.set(cinemaLabel, new Map());
    }

    const dates = groups.get(cinemaLabel)!;

    if (!dates.has(dateKey)) {
      dates.set(dateKey, []);
    }

    dates.get(dateKey)!.push(showtime);
  }

  return groups;
}

export function ShowtimesPage() {
  const { id } = useParams<{ id: string }>();

  const { data: movie } = useMovie(id);

  const {
    data,
    isLoading,
    isError,
  } = useShowtimes({
    movieId: id,
    pageSize: 50,
  });

  const groups = data
    ? groupShowtimes(data.items)
    : new Map<string, Map<string, Showtime[]>>();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {/* Encabezado */}
      <header className="mb-10">
        <p className="mb-2 text-sm uppercase tracking-[0.2em] text-ink-muted">
          Lumière · Selección de funciones
        </p>

        <h1 className="font-display text-3xl italic text-ink sm:text-4xl">
          {movie?.title ?? "Película"}
        </h1>

        <p className="mt-3 text-sm text-ink-muted">
          Elige tu fecha y horario favorito para continuar
          con la selección de asientos.
        </p>
      </header>

      {/* Estados */}
      {isLoading && (
        <p className="py-8 text-ink-muted">
          Cargando funciones disponibles…
        </p>
      )}

      {isError && (
        <p className="py-8 text-danger">
          No pudimos cargar las funciones.
          Intenta actualizar la página.
        </p>
      )}

      {data && data.items.length === 0 && (
        <div className="rounded-xl border border-white/10 p-8 text-center">
          <CalendarDays className="mx-auto mb-4 size-10 text-ink-muted" />

          <p className="text-ink">
            No hay funciones programadas por ahora.
          </p>

          <p className="mt-2 text-sm text-ink-muted">
            Pronto anunciaremos nuevos horarios.
          </p>
        </div>
      )}

      {/* Funciones agrupadas */}
      <div className="space-y-10">
        {Array.from(groups.entries()).map(
          ([cinemaLabel, dates]) => (
            <section key={cinemaLabel}>
              {/* Cine */}
              <div className="mb-6 border-b border-white/10 pb-4">
                <h2 className="flex items-center gap-2 font-display text-xl text-ink">
                  <MapPin className="size-5 text-amber-400" />
                  {cinemaLabel}
                </h2>
              </div>

              {/* Días */}
              <div className="space-y-6">
                {Array.from(dates.entries()).map(
                  ([dateKey, showtimes]) => {
                    const date = new Date(
                      showtimes[0].startTime
                    );

                    const dateLabel =
                      dateLabelFormatter.format(date);

                    return (
                      <div
                        key={dateKey}
                        className="rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
                      >
                        {/* Encabezado de fecha */}
                        <div className="mb-5 flex flex-wrap items-center gap-3">
                          <CalendarDays className="size-5 text-amber-400" />

                          <h3 className="text-base font-semibold capitalize text-ink">
                            {dateLabel}
                          </h3>

                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-ink-muted">
                            {showtimes.length} funciones
                          </span>
                        </div>

                        {/* Horarios */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {showtimes.map((showtime) => {
                            const soldOut =
                              showtime.availableSeats <= 0;

                            const time = timeFormatter.format(
                              new Date(showtime.startTime)
                            );

                            const price =
                              priceFormatter.format(
                                Number(showtime.basePrice)
                              );

                            const content = (
                              <div className="w-full space-y-2 text-left">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="flex items-center gap-2 text-base font-semibold">
                                    <Clock className="size-4" />
                                    {time}
                                  </span>

                                  <span className="rounded border border-current/20 px-2 py-0.5 text-xs">
                                    {showtime.format === "THREE_D"
                                      ? "3D"
                                      : "2D"}
                                  </span>
                                </div>

                                <div className="text-sm">
                                  {price}
                                </div>

                                <p className="text-xs text-ink-muted">
                                  {showtime.room.name}
                                </p>

                                <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                                  <Armchair className="size-3.5" />

                                  {soldOut
                                    ? "Agotado"
                                    : `${showtime.availableSeats} asientos disponibles`}
                                </div>
                              </div>
                            );

                            if (soldOut) {
                              return (
                                <Button
                                  key={showtime.id}
                                  variant="outline"
                                  disabled
                                  className="h-auto min-h-32 w-full justify-start p-4"
                                >
                                  {content}
                                </Button>
                              );
                            }

                            return (
                              <Button
                                key={showtime.id}
                                asChild
                                variant="outline"
                                className="h-auto min-h-32 w-full justify-start p-4 transition-colors hover:border-amber-400/60 hover:bg-amber-400/5"
                              >
                                <Link
                                  to={`/funciones/${showtime.id}/asientos`}
                                >
                                  {content}
                                </Link>
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </section>
          )
        )}
      </div>
    </main>
  );
}
