import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Film, QrCode, Sparkles } from "lucide-react";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth/auth.store";
import { useMyOrders } from "@/features/bookings/bookings.hooks";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";

/** Tarjeta del programa de puntos: o invita a unirse, o muestra el saldo. */
function LoyaltyCard() {
  const user = useAuthStore((s) => s.user);
  const joinLoyalty = useAuthStore((s) => s.joinLoyalty);
  const [isJoining, setIsJoining] = useState(false);

  if (!user) return null;

  async function join() {
    setIsJoining(true);
    try {
      await joinLoyalty();
      toast.success("Ya eres parte del programa de puntos");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos inscribirte al programa"));
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <section
      aria-label="Programa de puntos"
      className="relative mt-8 flex flex-wrap items-center justify-between gap-4 overflow-hidden border border-gold/40 bg-surface p-5"
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-gold" />
      <div className="pl-3">
        <p className="eyebrow flex items-center gap-1.5">
          <Sparkles className="size-3.5" /> Lumière Club
        </p>
        {user.loyaltyMember ? (
          <>
            <p className="mt-1 font-display text-4xl italic text-ink">
              {formatNumber(user.loyaltyPoints)} <span className="text-lg text-ink-muted">puntos</span>
            </p>
            <p className="mt-1 text-xs text-ink-muted">Sumas 1 punto por cada unidad que pagas en tus compras.</p>
          </>
        ) : (
          <>
            <p className="mt-1 font-display text-xl italic text-ink">Suma puntos con cada compra</p>
            <p className="mt-1 max-w-md text-sm text-ink-muted">
              Es gratis. Desde que te unes, cada boleto y combo que pagues te da puntos.
            </p>
          </>
        )}
      </div>
      {!user.loyaltyMember && (
        <Button onClick={() => void join()} disabled={isJoining}>
          {isJoining ? "Uniéndote…" : "Unirme al club"}
        </Button>
      )}
    </section>
  );
}

export function MyOrdersPage() {
  const { data, isLoading } = useMyOrders();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Tu historial</p>
      <h1 className="mt-1 font-display text-3xl italic text-ink">Mis boletos</h1>

      <LoyaltyCard />

      {isLoading && <p className="mt-8 text-ink-muted">Cargando tus boletos…</p>}
      {data && data.items.length === 0 && (
        <div className="mt-8 border border-dashed border-hairline p-8 text-center">
          <p className="font-display text-lg italic text-ink">Tu próxima función te espera</p>
          <p className="mt-1 text-sm text-ink-muted">Todavía no has comprado boletos.</p>
          <Button asChild className="mt-4">
            <Link to="/">Ver la cartelera</Link>
          </Button>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="mt-8 divide-y divide-hairline border border-hairline">
          {data.items.map((order) => (
            <div key={order.id} className="flex items-center gap-4 p-4">
              <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden border border-hairline bg-elevated">
                {order.showtime.movie.posterUrl ? (
                  <img
                    src={order.showtime.movie.posterUrl}
                    alt=""
                    width={56}
                    height={56}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : (
                  <Film className="size-5 text-ink-muted" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display italic text-ink">{order.showtime.movie.title}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {formatDate(order.createdAt)} · {formatMoney(order.totalAmount)}
                  {order.pointsEarned ? ` · +${formatNumber(order.pointsEarned)} pts` : ""}
                </p>
              </div>
              <OrderStatusBadge status={order.status} />
              {order.status === "PAID" && order.qrCode && (
                <Link
                  to="/confirmacion"
                  state={{ order }}
                  className="shrink-0 text-ink-muted transition-colors hover:text-gold"
                  aria-label={`Ver código QR de ${order.showtime.movie.title}`}
                >
                  <QrCode className="size-5" />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
