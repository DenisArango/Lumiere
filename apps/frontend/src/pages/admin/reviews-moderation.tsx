import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { StarRatingDisplay } from "@/components/star-rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAllReviews, useModerateReview } from "@/features/reviews/reviews.hooks";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const TABS = [
  { approved: true, label: "Visibles" },
  { approved: false, label: "Ocultas" },
];

export function ReviewsModerationPage() {
  const [approved, setApproved] = useState(true);
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAllReviews({ isApproved: approved, page, pageSize: 15 });
  const moderate = useModerateReview();

  async function toggle(reviewId: string, isApproved: boolean) {
    try {
      await moderate.mutateAsync({ reviewId, isApproved });
      toast.success(isApproved ? "Reseña visible de nuevo" : "Reseña oculta del público");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos actualizar la reseña"));
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Comunidad"
        title="Reseñas"
        description="Oculta lo que no cumpla las reglas. Una reseña oculta deja de verse y de contar en el promedio."
      />

      <div className="mt-5 flex gap-1 border-b border-hairline" role="tablist" aria-label="Estado de la reseña">
        {TABS.map((tab) => (
          <button
            key={tab.label}
            role="tab"
            aria-selected={approved === tab.approved}
            onClick={() => {
              setApproved(tab.approved);
              setPage(1);
            }}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              approved === tab.approved ? "border-gold text-ink" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="mt-6 text-sm text-ink-muted">Cargando reseñas…</p>}

      <div className="mt-4 divide-y divide-hairline border border-hairline">
        {data?.items.map((review) => (
          <div key={review.id} className="flex items-start gap-4 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link
                  to={`/peliculas/${review.movie.id}`}
                  className="font-display italic text-ink underline-offset-4 hover:text-gold hover:underline"
                >
                  {review.movie.title}
                </Link>
                <StarRatingDisplay value={review.rating} />
                {review.isVerifiedPurchase && <Badge tone="success">Compra verificada</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-ink-muted">
                {review.user.firstName} {review.user.lastName} · {formatDate(review.createdAt)}
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink">
                {review.comment ?? <span className="text-ink-muted">Sin comentario, solo calificación.</span>}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={moderate.isPending}
              onClick={() => void toggle(review.id, !review.isApproved)}
            >
              {review.isApproved ? (
                <>
                  <EyeOff className="size-3.5" /> Ocultar
                </>
              ) : (
                <>
                  <Eye className="size-3.5" /> Mostrar
                </>
              )}
            </Button>
          </div>
        ))}
        {data && data.items.length === 0 && (
          <p className="p-8 text-center text-sm text-ink-muted">
            {approved ? "Todavía no hay reseñas visibles." : "No hay reseñas ocultas. Todo en orden."}
          </p>
        )}
      </div>

      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}
    </div>
  );
}
