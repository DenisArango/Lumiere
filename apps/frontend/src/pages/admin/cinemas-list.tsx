import { Link } from "react-router-dom";
import { Building2, Plus } from "lucide-react";
import { useCinemas } from "@/features/cinemas/cinemas.hooks";
import { Button } from "@/components/ui/button";

export function CinemasListPage() {
  const { data, isLoading } = useCinemas();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Ubicaciones</p>
          <h1 className="mt-1 font-display text-2xl italic text-ink">Cines</h1>
        </div>
        <Button asChild size="sm">
          <Link to="/admin/cines/nuevo">
            <Plus className="size-4" /> Nuevo
          </Link>
        </Button>
      </div>

      {isLoading && <p className="mt-8 text-sm text-ink-muted">Cargando…</p>}

      <div className="mt-6 divide-y divide-hairline border border-hairline">
        {data?.items.map((cinema) => (
          <Link
            key={cinema.id}
            to={`/admin/cines/${cinema.id}`}
            className="flex items-center gap-4 p-3 transition-colors hover:bg-surface"
          >
            <div className="flex size-10 shrink-0 items-center justify-center border border-hairline bg-elevated">
              <Building2 className="size-4 text-ink-muted" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display italic text-ink">{cinema.name}</p>
              <p className="text-xs text-ink-muted">
                {cinema.address}, {cinema.city}
              </p>
            </div>
          </Link>
        ))}
        {data && data.items.length === 0 && (
          <p className="p-6 text-center text-sm text-ink-muted">Todavía no hay cines registrados.</p>
        )}
      </div>
    </div>
  );
}
