import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BadgeCheck, Trash2 } from "lucide-react";
import { StarRatingDisplay, StarRatingInput } from "@/components/star-rating";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth/auth.store";
import { useCreateReview, useDeleteReview, useReviews, useUpdateReview } from "@/features/reviews/reviews.hooks";
import { getApiErrorMessage } from "@/lib/api-client";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  return `hace ${months} ${months === 1 ? "mes" : "meses"}`;
}

export function ReviewsSection({ movieId }: { movieId: string }) {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useReviews(movieId);
  const createMutation = useCreateReview(movieId);
  const deleteMutation = useDeleteReview(movieId);

  const myReview = data?.items.find((r) => r.user.id === user?.id);
  const updateMutation = useUpdateReview(movieId, myReview?.id ?? "");

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);

  const isEditingExisting = Boolean(myReview) && editing;
  const showForm = user && (!myReview || editing);

  function startEditing() {
    if (!myReview) return;
    setRating(myReview.rating);
    setComment(myReview.comment ?? "");
    setEditing(true);
  }

  async function handleSubmit() {
    if (rating === 0) {
      toast.error("Selecciona una calificación");
      return;
    }
    try {
      if (isEditingExisting) {
        await updateMutation.mutateAsync({ rating, comment: comment || undefined });
      } else {
        await createMutation.mutateAsync({ rating, comment: comment || undefined });
      }
      toast.success("Gracias por tu reseña");
      setEditing(false);
      setRating(0);
      setComment("");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos guardar tu reseña"));
    }
  }

  async function handleDelete() {
    if (!myReview) return;
    try {
      await deleteMutation.mutateAsync(myReview.id);
      toast.success("Reseña eliminada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos eliminar tu reseña"));
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const others = data?.items.filter((r) => r.id !== myReview?.id) ?? [];

  return (
    <div className="border-t border-hairline pt-6">
      <p className="eyebrow">Opiniones</p>
      <h2 className="mt-1 font-display text-lg italic text-ink">Lo que dice la audiencia</h2>

      {!user && (
        <p className="mt-4 text-sm text-ink-muted">
          <Link to="/iniciar-sesion" className="text-gold hover:underline">
            Inicia sesión
          </Link>{" "}
          para dejar tu opinión.
        </p>
      )}

      {user && myReview && !editing && (
        <div className="mt-4 flex items-center gap-3 border border-hairline p-3">
          <StarRatingDisplay value={myReview.rating} />
          <p className="flex-1 text-sm text-ink-muted">Ya dejaste tu reseña.</p>
          <button type="button" onClick={startEditing} className="text-xs text-gold hover:underline">
            Editar
          </button>
          <button type="button" onClick={() => void handleDelete()} className="text-ink-muted hover:text-danger">
            <Trash2 className="size-4" />
          </button>
        </div>
      )}

      {showForm && (
        <div className="mt-4 space-y-3 border border-hairline p-4">
          <StarRatingInput value={rating} onChange={setRating} disabled={isSubmitting} />
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="¿Qué te pareció? (opcional)"
            rows={3}
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={isSubmitting} onClick={() => void handleSubmit()}>
              {isSubmitting ? "Guardando…" : isEditingExisting ? "Guardar cambios" : "Publicar reseña"}
            </Button>
            {editing && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {isLoading && <p className="text-sm text-ink-muted">Cargando reseñas…</p>}
        {data && data.items.length === 0 && (
          <p className="text-sm text-ink-muted">Todavía no hay reseñas. Sé la primera persona en opinar.</p>
        )}
        {others.map((review) => (
          <div key={review.id} className="border-b border-hairline pb-4 last:border-0">
            <div className="flex items-center gap-2">
              <StarRatingDisplay value={review.rating} />
              <span className="text-sm font-medium text-ink">
                {review.user.firstName} {review.user.lastName[0]}.
              </span>
              {review.isVerifiedPurchase && (
                <span className="flex items-center gap-1 text-xs text-success" title="Compra verificada">
                  <BadgeCheck className="size-3.5" /> Compra verificada
                </span>
              )}
              <span className="text-xs text-ink-muted">{timeAgo(review.createdAt)}</span>
            </div>
            {review.comment && <p className="mt-1.5 text-sm text-ink-muted">{review.comment}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
