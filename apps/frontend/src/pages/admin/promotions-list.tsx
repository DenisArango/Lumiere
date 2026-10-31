import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Pencil, Plus, Tag } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePromotionsAdmin, useUpdatePromotion } from "@/features/promotions/promotions.hooks";
import type { Promotion } from "@/features/promotions/promotions.types";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDate, formatMoney } from "@/lib/format";

function statusOf(promo: Promotion): { label: string; tone: "success" | "muted" | "gold" } {
  const now = Date.now();
  if (!promo.isActive) return { label: "Desactivada", tone: "muted" };
  if (new Date(promo.endDate).getTime() < now) return { label: "Vencida", tone: "muted" };
  if (new Date(promo.startDate).getTime() > now) return { label: "Programada", tone: "gold" };
  return { label: "Vigente", tone: "success" };
}

export function PromotionsListPage() {
  const { data, isLoading } = usePromotionsAdmin();
  const updateMutation = useUpdatePromotion();

  async function toggle(promo: Promotion) {
    try {
      await updateMutation.mutateAsync({ id: promo.id, input: { isActive: !promo.isActive } });
      toast.success(promo.isActive ? "Promoción desactivada" : "Promoción reactivada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos actualizar la promoción"));
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Descuentos"
        title="Promociones"
        description="Todas las promociones, vigentes o no. El código solo funciona mientras esté vigente y activa."
        action={
          <Button asChild size="sm">
            <Link to="/admin/promociones/nueva">
              <Plus className="size-4" /> Nueva
            </Link>
          </Button>
        }
      />

      {isLoading && <p className="mt-6 text-sm text-ink-muted">Cargando promociones…</p>}

      <div className="mt-5 divide-y divide-hairline border border-hairline">
        {data?.map((promo) => {
          const status = statusOf(promo);
          return (
            <div key={promo.id} className="flex flex-wrap items-center gap-4 p-3">
              <Tag className="size-4 shrink-0 text-ink-muted" />
              <div className="min-w-0 flex-1 basis-56">
                <p className="text-sm text-ink">{promo.name}</p>
                <p className="text-xs text-ink-muted">
                  <span className="font-semibold tracking-wider text-gold">{promo.code}</span> ·{" "}
                  {promo.discountType === "PERCENTAGE"
                    ? `${Number(promo.discountValue)} %`
                    : formatMoney(promo.discountValue)}{" "}
                  de descuento · {promo.rules.length === 0 ? "global" : `${promo.rules.length} regla(s)`}
                </p>
                <p className="text-xs text-ink-muted">
                  {formatDate(promo.startDate)} – {formatDate(promo.endDate)}
                </p>
              </div>
              <Badge tone={status.tone}>{status.label}</Badge>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/admin/promociones/${promo.id}/editar`}>
                  <Pencil className="size-3.5" /> Editar
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={updateMutation.isPending}
                onClick={() => void toggle(promo)}
              >
                {promo.isActive ? "Desactivar" : "Reactivar"}
              </Button>
            </div>
          );
        })}
        {data && data.length === 0 && (
          <p className="p-8 text-center text-sm text-ink-muted">Todavía no hay promociones.</p>
        )}
      </div>
    </div>
  );
}
