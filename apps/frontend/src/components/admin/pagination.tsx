import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}

/** Paginacion minima para listas del panel: total a la izquierda, anterior/siguiente a la derecha. */
export function Pagination({ page, totalPages, total, onChange }: PaginationProps) {
  if (total === 0) return null;

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-ink-muted">
      <span>
        {total} {total === 1 ? "registro" : "registros"} · página {page} de {totalPages}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Página siguiente"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
