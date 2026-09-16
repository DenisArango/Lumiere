import { Link } from "react-router-dom";
import { CalendarClock, Plus } from "lucide-react";
import { useShowtimesAll } from "@/features/showtimes/showtimes.hooks";
import { Button } from "@/components/ui/button";

export function ShowtimesListPage() {
  const { data, isLoading } = useShowtimesAll({ pageSize: 50 });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Programación</p>
          <h1 className="mt-1 font-display text-2xl italic text-ink">Funciones</h1>
        </div>
        <Button asChild size="sm">
          <Link to="/admin/funciones/nueva">
            <Plus className="size-4" /> Nueva
          </Link>
        </Button>
      </div>

      {isLoading && <p className="mt-8 text-sm text-ink-muted">Cargando…</p>}

      <div className="mt-6 divide-y divide-hairline border border-hairline">
        {data?.items.map((s) => (
          <div key={s.id} className="flex items-center gap-4 p-3">
            <CalendarClock className="size-4 shrink-0 text-ink-muted" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display italic text-ink">{s.movie.title}</p>
              <p className="text-xs text-ink-muted">
                {s.room.cinema.name} · {s.room.name} ·{" "}
                {new Date(s.startTime).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            <span className="eyebrow border border-hairline px-2 py-1 text-ink-muted">
              {s.availableSeats} disponibles
            </span>
          </div>
        ))}
        {data && data.items.length === 0 && (
          <p className="p-6 text-center text-sm text-ink-muted">No hay funciones programadas.</p>
        )}
      </div>
    </div>
  );
}
