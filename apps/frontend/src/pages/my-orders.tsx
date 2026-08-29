import { Link } from "react-router-dom";
import { Film, QrCode } from "lucide-react";
import { useMyOrders } from "@/features/bookings/bookings.hooks";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente de pago",
  PAID: "Confirmada",
  CANCELLED: "Cancelada",
  REFUNDED: "Reembolsada",
  EXPIRED: "Expirada",
};

export function MyOrdersPage() {
  const { data, isLoading } = useMyOrders();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Tu historial</p>
      <h1 className="mt-1 font-display text-2xl italic text-ink">Mis boletos</h1>

      {isLoading && <p className="mt-8 text-ink-muted">Cargando…</p>}
      {data && data.items.length === 0 && (
        <p className="mt-8 text-ink-muted">Todavía no has comprado boletos.</p>
      )}

      <div className="mt-8 divide-y divide-hairline border border-hairline">
        {data?.items.map((order) => (
          <div key={order.id} className="flex items-center gap-4 p-4">
            <div className="flex size-14 shrink-0 items-center justify-center border border-hairline bg-elevated">
              {order.showtime.movie.posterUrl ? (
                <img src={order.showtime.movie.posterUrl} alt="" className="size-full object-cover" />
              ) : (
                <Film className="size-5 text-ink-muted" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display italic text-ink">{order.showtime.movie.title}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {new Date(order.createdAt).toLocaleDateString("es", { dateStyle: "medium" })} · $
                {Number(order.totalAmount).toFixed(2)}
              </p>
            </div>
            <span
              className={cn(
                "eyebrow shrink-0 border px-2 py-1",
                order.status === "PAID" && "border-success text-success",
                order.status === "PENDING" && "border-gold text-gold",
                (order.status === "CANCELLED" || order.status === "EXPIRED") && "border-hairline text-ink-muted",
                order.status === "REFUNDED" && "border-danger text-danger",
              )}
            >
              {STATUS_LABEL[order.status] ?? order.status}
            </span>
            {order.status === "PAID" && order.qrCode && (
              <Link
                to="/confirmacion"
                state={{ order }}
                className="shrink-0 text-ink-muted transition-colors hover:text-gold"
                title="Ver código QR"
              >
                <QrCode className="size-5" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
