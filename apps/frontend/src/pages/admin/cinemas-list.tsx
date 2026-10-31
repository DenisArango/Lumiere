import { Link } from "react-router-dom";
import { Building2, ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCinemasAdmin } from "@/features/cinemas/cinemas.hooks";

export function CinemasListPage() {
  const { data, isLoading } = useCinemasAdmin();

  return (
    <div>
      <PageHeader
        eyebrow="Ubicaciones"
        title="Cines"
        description="Cada cine agrupa sus salas. Desactivar un cine lo oculta del público sin borrar su historial."
        action={
          <Button asChild size="sm">
            <Link to="/admin/cines/nuevo">
              <Plus className="size-4" /> Nuevo
            </Link>
          </Button>
        }
      />

      {isLoading && <p className="mt-6 text-sm text-ink-muted">Cargando cines…</p>}

      <div className="mt-5 divide-y divide-hairline border border-hairline">
        {data?.items.map((cinema) => (
          <Link
            key={cinema.id}
            to={`/admin/cines/${cinema.id}`}
            className="group flex items-center gap-4 p-3 transition-colors hover:bg-surface"
          >
            <div className="flex size-10 shrink-0 items-center justify-center border border-hairline bg-elevated">
              <Building2 className="size-4 text-ink-muted" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display italic text-ink">{cinema.name}</p>
              <p className="truncate text-xs text-ink-muted">
                {cinema.address}, {cinema.city}
              </p>
            </div>
            {!cinema.isActive && <Badge>Desactivado</Badge>}
            <ChevronRight className="size-4 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-gold" />
          </Link>
        ))}
        {data && data.items.length === 0 && (
          <p className="p-8 text-center text-sm text-ink-muted">Todavía no hay cines registrados.</p>
        )}
      </div>
    </div>
  );
}
