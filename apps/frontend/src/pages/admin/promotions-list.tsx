import { Link } from "react-router-dom";
import { Plus, Tag } from "lucide-react";
import { usePromotions } from "@/features/promotions/promotions.hooks";
import { Button } from "@/components/ui/button";

export function PromotionsListPage() {
  const { data, isLoading } = usePromotions();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Descuentos</p>
          <h1 className="mt-1 font-display text-2xl italic text-ink">Promociones</h1>
          <p className="mt-1 text-xs text-ink-muted">Muestra las promociones activas y vigentes actualmente.</p>
        </div>
        <Button asChild size="sm">
          <Link to="/admin/promociones/nueva">
            <Plus className="size-4" /> Nueva
          </Link>
        </Button>
      </div>

      {isLoading && <p className="mt-8 text-sm text-ink-muted">Cargando…</p>}

      <div className="mt-6 divide-y divide-hairline border border-hairline">
        {data?.map((promo) => (
          <div key={promo.id} className="flex items-center gap-4 p-3">
            <Tag className="size-4 shrink-0 text-ink-muted" />
            <div className="flex-1">
              <p className="text-sm text-ink">{promo.name}</p>
              <p className="text-xs text-ink-muted">
                {promo.code} ·{" "}
                {promo.discountType === "PERCENTAGE" ? `${promo.discountValue}%` : `$${promo.discountValue}`}{" "}
                de descuento · {promo.rules.length === 0 ? "global" : `${promo.rules.length} regla(s)`}
              </p>
            </div>
          </div>
        ))}
        {data && data.length === 0 && (
          <p className="p-6 text-center text-sm text-ink-muted">No hay promociones activas en este momento.</p>
        )}
      </div>
    </div>
  );
}
