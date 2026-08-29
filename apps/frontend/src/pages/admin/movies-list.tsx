import { Link } from "react-router-dom";
import { Film, Plus } from "lucide-react";
import { useMovies } from "@/features/movies/movies.hooks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  COMING_SOON: "Próximamente",
  IN_THEATERS: "En cartelera",
  ARCHIVED: "Archivada",
};

export function MoviesListPage() {
  const { data, isLoading } = useMovies({ pageSize: 50 });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Catálogo</p>
          <h1 className="mt-1 font-display text-2xl italic text-ink">Películas</h1>
        </div>
        <Button asChild size="sm">
          <Link to="/admin/peliculas/nueva">
            <Plus className="size-4" /> Nueva
          </Link>
        </Button>
      </div>

      {isLoading && <p className="mt-8 text-sm text-ink-muted">Cargando…</p>}

      <div className="mt-6 divide-y divide-hairline border border-hairline">
        {data?.items.map((movie) => (
          <Link
            key={movie.id}
            to={`/admin/peliculas/${movie.id}/editar`}
            className="flex items-center gap-4 p-3 transition-colors hover:bg-surface"
          >
            <div className="flex size-12 shrink-0 items-center justify-center border border-hairline bg-elevated">
              {movie.posterUrl ? (
                <img src={movie.posterUrl} alt="" className="size-full object-cover" />
              ) : (
                <Film className="size-4 text-ink-muted" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display italic text-ink">{movie.title}</p>
              <p className="text-xs text-ink-muted">
                {movie.releaseYear} · {movie.durationMinutes} min · {movie.rating.code}
              </p>
            </div>
            <span
              className={cn(
                "eyebrow border px-2 py-1",
                movie.status === "IN_THEATERS" && "border-success text-success",
                movie.status === "COMING_SOON" && "border-gold text-gold",
                movie.status === "ARCHIVED" && "border-hairline text-ink-muted",
              )}
            >
              {STATUS_LABEL[movie.status]}
            </span>
          </Link>
        ))}
        {data && data.items.length === 0 && (
          <p className="p-6 text-center text-sm text-ink-muted">Todavía no hay películas registradas.</p>
        )}
      </div>
    </div>
  );
}
