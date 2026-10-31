import { useState } from "react";
import { toast } from "sonner";
import { Film, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAllOrders, useRefundOrder } from "@/features/bookings/bookings.hooks";
import type { AdminOrder, OrderStatus } from "@/features/bookings/bookings.types";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const TABS: { value: OrderStatus | undefined; label: string }[] = [
  { value: undefined, label: "Todas" },
  { value: "PAID", label: "Confirmadas" },
  { value: "PENDING", label: "Pendientes" },
  { value: "REFUNDED", label: "Reembolsadas" },
  { value: "CANCELLED", label: "Canceladas" },
];

export function OrdersListPage() {
  const [status, setStatus] = useState<OrderStatus | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [toRefund, setToRefund] = useState<AdminOrder | null>(null);

  const { data, isLoading } = useAllOrders({ status, page, pageSize: 15 });
  const refundMutation = useRefundOrder();

  async function confirmRefund() {
    if (!toRefund) return;
    try {
      await refundMutation.mutateAsync(toRefund.id);
      toast.success("Orden reembolsada y butacas liberadas");
      setToRefund(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos reembolsar la orden"));
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Ventas"
        title="Órdenes"
        description="Todas las compras. Un reembolso devuelve el cobro y libera las butacas."
      />

      <div className="mt-5 flex flex-wrap gap-1 border-b border-hairline" role="tablist" aria-label="Filtrar por estado">
        {TABS.map((tab) => (
          <button
            key={tab.label}
            role="tab"
            aria-selected={status === tab.value}
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              status === tab.value ? "border-gold text-ink" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="mt-6 text-sm text-ink-muted">Cargando órdenes…</p>}

      <div className="mt-4 divide-y divide-hairline border border-hairline">
        {data?.items.map((order) => (
          <div key={order.id} className="flex flex-wrap items-center gap-4 p-3">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden border border-hairline bg-elevated">
              {order.showtime.movie.posterUrl ? (
                <img
                  src={order.showtime.movie.posterUrl}
                  alt=""
                  width={48}
                  height={48}
                  loading="lazy"
                  className="size-full object-cover"
                />
              ) : (
                <Film className="size-4 text-ink-muted" />
              )}
            </div>
            <div className="min-w-0 flex-1 basis-56">
              <p className="truncate font-display italic text-ink">{order.showtime.movie.title}</p>
              <p className="truncate text-xs text-ink-muted">
                {order.user.firstName} {order.user.lastName} · {order.user.email}
              </p>
              <p className="text-xs text-ink-muted">
                Función {formatDateTime(order.showtime.startTime)}
                {/* Las órdenes canceladas, reembolsadas o expiradas sueltan sus butacas para que puedan venderse de nuevo. */}
                {order.seats.length > 0 && ` · ${order.seats.length} ${order.seats.length === 1 ? "butaca" : "butacas"}`}
                {order.payment ? ` · ${order.payment.provider === "STRIPE" ? "Stripe" : "PayPal"}` : ""}
              </p>
            </div>
            <p className="w-24 text-right font-display text-lg italic text-ink">{formatMoney(order.totalAmount)}</p>
            <OrderStatusBadge status={order.status} />
            {order.status === "PAID" ? (
              <Button variant="outline" size="sm" onClick={() => setToRefund(order)}>
                <Undo2 className="size-3.5" /> Reembolsar
              </Button>
            ) : (
              <span className="w-[7.25rem]" aria-hidden />
            )}
          </div>
        ))}
        {data && data.items.length === 0 && (
          <p className="p-8 text-center text-sm text-ink-muted">No hay órdenes con este estado.</p>
        )}
      </div>

      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}

      <ConfirmDialog
        open={toRefund !== null}
        onOpenChange={(open) => !open && setToRefund(null)}
        title="¿Reembolsar esta orden?"
        description={
          toRefund
            ? `Se devolverán ${formatMoney(toRefund.totalAmount)} a ${toRefund.user.firstName} ${toRefund.user.lastName} y las butacas de “${toRefund.showtime.movie.title}” quedarán libres. Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Sí, reembolsar"
        destructive
        isPending={refundMutation.isPending}
        onConfirm={() => void confirmRefund()}
      />
    </div>
  );
}
