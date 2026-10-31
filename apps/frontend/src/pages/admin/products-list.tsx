import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Pencil, Plus, Popcorn } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProductsAdmin, useUpdateProduct } from "@/features/products/products.hooks";
import type { Product } from "@/features/products/products.types";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";

export function ProductsListPage() {
  const { data, isLoading } = useProductsAdmin();
  const updateMutation = useUpdateProduct();

  async function toggle(product: Product) {
    try {
      await updateMutation.mutateAsync({ id: product.id, input: { isActive: !product.isActive } });
      toast.success(product.isActive ? "Producto retirado de la venta" : "Producto de vuelta en venta");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos actualizar el producto"));
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Dulcería"
        title="Combos y productos"
        description="Lo que se puede agregar a una compra. Un producto retirado deja de ofrecerse en el checkout."
        action={
          <Button asChild size="sm">
            <Link to="/admin/productos/nuevo">
              <Plus className="size-4" /> Nuevo
            </Link>
          </Button>
        }
      />

      {isLoading && <p className="mt-6 text-sm text-ink-muted">Cargando productos…</p>}

      <div className="mt-5 divide-y divide-hairline border border-hairline">
        {data?.map((product) => (
          <div key={product.id} className="flex flex-wrap items-center gap-4 p-3">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden border border-hairline bg-elevated">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt="" width={48} height={48} loading="lazy" className="size-full object-cover" />
              ) : (
                <Popcorn className="size-4 text-ink-muted" />
              )}
            </div>
            <div className="min-w-0 flex-1 basis-48">
              <p className="text-sm text-ink">{product.name}</p>
              {product.description && <p className="truncate text-xs text-ink-muted">{product.description}</p>}
            </div>
            <Badge tone={product.isActive ? "success" : "muted"}>{product.isActive ? "En venta" : "Retirado"}</Badge>
            <p className="w-20 text-right font-display italic text-ink">{formatMoney(product.price)}</p>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/admin/productos/${product.id}/editar`}>
                <Pencil className="size-3.5" /> Editar
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={updateMutation.isPending}
              onClick={() => void toggle(product)}
            >
              {product.isActive ? "Retirar" : "Reactivar"}
            </Button>
          </div>
        ))}
        {data && data.length === 0 && (
          <p className="p-8 text-center text-sm text-ink-muted">Sin productos registrados todavía.</p>
        )}
      </div>
    </div>
  );
}
