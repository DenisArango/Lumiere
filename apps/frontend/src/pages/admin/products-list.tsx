import { Link } from "react-router-dom";
import { Popcorn, Plus } from "lucide-react";
import { useProducts } from "@/features/products/products.hooks";
import { Button } from "@/components/ui/button";

export function ProductsListPage() {
  const { data, isLoading } = useProducts();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Dulcería</p>
          <h1 className="mt-1 font-display text-2xl italic text-ink">Combos y productos</h1>
        </div>
        <Button asChild size="sm">
          <Link to="/admin/productos/nuevo">
            <Plus className="size-4" /> Nuevo
          </Link>
        </Button>
      </div>

      {isLoading && <p className="mt-8 text-sm text-ink-muted">Cargando…</p>}

      <div className="mt-6 divide-y divide-hairline border border-hairline">
        {data?.map((product) => (
          <div key={product.id} className="flex items-center gap-4 p-3">
            <div className="flex size-10 shrink-0 items-center justify-center border border-hairline bg-elevated">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt="" className="size-full object-cover" />
              ) : (
                <Popcorn className="size-4 text-ink-muted" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm text-ink">{product.name}</p>
              {product.description && <p className="text-xs text-ink-muted">{product.description}</p>}
            </div>
            <span className="font-display italic text-ink">${product.price}</span>
          </div>
        ))}
        {data && data.length === 0 && (
          <p className="p-6 text-center text-sm text-ink-muted">Sin productos registrados todavía.</p>
        )}
      </div>
    </div>
  );
}
