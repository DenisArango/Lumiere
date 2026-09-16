import { useRef, useState } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { CreditCard, Minus, Plus, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useShowtime } from "@/features/showtimes/showtimes.hooks";
import { useSeatMap, useReleaseSeats } from "@/features/bookings/bookings.hooks";
import { createOrder, payOrder } from "@/features/bookings/bookings.api";
import { useProducts } from "@/features/products/products.hooks";
import { getApiErrorMessage } from "@/lib/api-client";
import { useEffectOnUnmount } from "@/lib/use-effect-on-unmount";
import { cn } from "@/lib/utils";

interface CheckoutState {
  showtimeId: string;
  seatIds: string[];
}

export function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as CheckoutState | null;

  const { data: showtime } = useShowtime(state?.showtimeId);
  const { data: seatMap } = useSeatMap(state?.showtimeId);
  const { data: products } = useProducts();
  const releaseMutation = useReleaseSeats(state?.showtimeId ?? "");

  const [provider, setProvider] = useState<"STRIPE" | "PAYPAL">("STRIPE");
  const [promoCode, setPromoCode] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const orderCreatedRef = useRef(false);

  function setQuantity(productId: string, next: number) {
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(0, next) }));
  }

  useEffectOnUnmount(() => {
    if (!orderCreatedRef.current && state) {
      void releaseMutation.mutateAsync(state.seatIds);
    }
  });

  if (!state) {
    return <Navigate to="/" replace />;
  }

  const mySeats = seatMap?.filter((s) => state.seatIds.includes(s.id)) ?? [];
  const seatsSubtotal = showtime
    ? mySeats.reduce((sum, s) => sum + Number(showtime.basePrice) * Number(s.seatType.priceMultiplier), 0)
    : 0;
  const itemsSubtotal = (products ?? []).reduce(
    (sum, p) => sum + Number(p.price) * (quantities[p.id] ?? 0),
    0,
  );
  const subtotal = seatsSubtotal + itemsSubtotal;

  async function handlePay() {
    setIsSubmitting(true);
    try {
      const items = Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([productId, quantity]) => ({ productId, quantity }));

      const order = await createOrder({
        showtimeId: state!.showtimeId,
        seatIds: state!.seatIds,
        promotionCode: promoCode.trim() || undefined,
        items: items.length > 0 ? items : undefined,
      });
      orderCreatedRef.current = true;

      const paidOrder = await payOrder(order.id, provider, `dev_${provider.toLowerCase()}_token`);
      navigate("/confirmacion", { state: { order: paidOrder }, replace: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos procesar tu pago"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Un paso más</p>
      <h1 className="mt-1 font-display text-2xl italic text-ink">Confirma tu compra</h1>

      <div className="mt-8 border border-hairline">
        <div className="flex items-center gap-2 border-b border-hairline px-5 py-3">
          <Ticket className="size-4 text-gold" />
          <p className="text-sm font-medium text-ink">{showtime?.movie.title}</p>
        </div>
        <div className="space-y-1 px-5 py-4 text-sm text-ink-muted">
          {showtime && (
            <p>
              {showtime.room.cinema.name} · {new Date(showtime.startTime).toLocaleString("es", { dateStyle: "long", timeStyle: "short" })}
            </p>
          )}
          <p>
            Butacas:{" "}
            {mySeats.map((s) => `${s.rowLabel}${s.seatNumber}`).join(", ") || "—"}
          </p>
        </div>
      </div>

      {products && products.length > 0 && (
        <div className="mt-6">
          <p className="eyebrow">Dulcería (opcional)</p>
          <div className="mt-2 divide-y divide-hairline border border-hairline">
            {products.map((product) => {
              const qty = quantities[product.id] ?? 0;
              return (
                <div key={product.id} className="flex items-center gap-3 p-3">
                  <div className="flex-1">
                    <p className="text-sm text-ink">{product.name}</p>
                    <p className="text-xs text-ink-muted">${product.price}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuantity(product.id, qty - 1)}
                    disabled={qty === 0}
                    className="flex size-7 items-center justify-center border border-hairline text-ink-muted hover:text-ink disabled:opacity-30"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-5 text-center text-sm text-ink">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(product.id, qty + 1)}
                    className="flex size-7 items-center justify-center border border-hairline text-ink-muted hover:text-ink"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6 space-y-1.5">
        <Label htmlFor="promo">Código de promoción (opcional)</Label>
        <Input id="promo" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="EJ. LUMIERE20" />
      </div>

      <div className="mt-6">
        <p className="eyebrow">Método de pago</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {(["STRIPE", "PAYPAL"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              className={cn(
                "flex items-center justify-center gap-2 border px-4 py-3 text-sm font-medium transition-colors",
                provider === p ? "border-gold text-gold" : "border-hairline text-ink-muted hover:text-ink",
              )}
            >
              <CreditCard className="size-4" /> {p === "STRIPE" ? "Tarjeta (Stripe)" : "PayPal"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Este entorno intenta un cobro real contra {provider === "STRIPE" ? "Stripe" : "PayPal"}. Si el
          proyecto todavía no tiene credenciales sandbox configuradas, verás el error real del servidor —
          no es un formulario de demostración.
        </p>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-hairline pt-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-muted">Total</p>
          <p className="font-display text-2xl italic text-ink">${subtotal.toFixed(2)}</p>
        </div>
        <Button size="lg" disabled={isSubmitting} onClick={() => void handlePay()}>
          {isSubmitting ? "Procesando…" : "Confirmar pago"}
        </Button>
      </div>
    </div>
  );
}
