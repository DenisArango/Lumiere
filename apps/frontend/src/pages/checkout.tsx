
import { useRef, useState } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { CreditCard, Minus, Plus, Ticket, ShoppingBag } from "lucide-react";

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

const formatPrice = (amount: number) =>
  new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

function getProductName(name: string) {
  if (name.trim().toLowerCase() === "combo lumiere") {
    return "Combo de palomitas Lumière";
  }
  return name;
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
    setQuantities((prev) => ({
      ...prev,
      [productId]: Math.max(0, next),
    }));
  }

  useEffectOnUnmount(() => {
    if (!orderCreatedRef.current && state) {
      void releaseMutation.mutateAsync(state.seatIds);
    }
  });

  if (!state) {
    return <Navigate to="/" replace />;
  }

  const mySeats =
    seatMap?.filter((seat) => state.seatIds.includes(seat.id)) ?? [];

  const seatsSubtotal = showtime
    ? mySeats.reduce(
        (sum, seat) =>
          sum +
          Number(showtime.basePrice) *
            Number(seat.seatType.priceMultiplier),
        0,
      )
    : 0;

  const selectedProducts = (products ?? [])
    .filter((product) => (quantities[product.id] ?? 0) > 0)
    .map((product) => ({
      ...product,
      quantity: quantities[product.id],
      total: Number(product.price) * quantities[product.id],
    }));

  const itemsSubtotal = selectedProducts.reduce(
    (sum, product) => sum + product.total,
    0,
  );

  const subtotal = seatsSubtotal + itemsSubtotal;

  async function handlePay() {
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const items = Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([productId, quantity]) => ({
          productId,
          quantity,
        }));

      const order = await createOrder({
        showtimeId: state!.showtimeId,
        seatIds: state!.seatIds,
        promotionCode: promoCode.trim() || undefined,
        items: items.length > 0 ? items : undefined,
      });

      orderCreatedRef.current = true;

      const paidOrder = await payOrder(
        order.id,
        provider,
        `dev_${provider.toLowerCase()}_token`,
      );

      navigate("/confirmacion", {
        state: { order: paidOrder },
        replace: true,
      });
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "No pudimos procesar tu pago"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">

      {/* ENCABEZADO */}
      <p className="eyebrow">Un paso más</p>

      <h1 className="mt-1 font-display text-3xl italic text-ink">
        Confirma tu compra
      </h1>

      <p className="mt-2 text-sm text-ink-muted">
        Revisa los detalles antes de finalizar tu compra.
      </p>

      {/* INFORMACIÓN DE LA PELÍCULA */}
      <div className="mt-8 border border-hairline">

        <div className="flex items-center gap-2 border-b border-hairline px-5 py-4">
          <Ticket className="size-5 text-gold" />

          <p className="font-medium text-ink">
            {showtime?.movie.title ?? "Cargando película..."}
          </p>
        </div>

        <div className="space-y-2 px-5 py-5 text-sm text-ink-muted">

          {showtime && (
            <>
              <p>{showtime.room.cinema.name}</p>

              <p>
                {new Date(showtime.startTime).toLocaleString("es-GT", {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </p>
            </>
          )}

          <p className="font-medium text-ink">
            {mySeats.length === 1 ? "Asiento" : "Asientos"}:{" "}
            {mySeats
              .map((seat) => `${seat.rowLabel}${seat.seatNumber}`)
              .join(", ") || "—"}
          </p>

        </div>
      </div>

      {/* DULCERÍA */}
      {products && products.length > 0 && (
        <div className="mt-8">

          <div className="flex items-center gap-2">
            <ShoppingBag className="size-4 text-gold" />
            <p className="eyebrow">Dulcería (opcional)</p>
          </div>

          <p className="mt-2 text-sm text-ink-muted">
            Acompaña tu película con tus productos favoritos.
          </p>

          <div className="mt-4 divide-y divide-hairline border border-hairline">

            {products.map((product) => {
              const qty = quantities[product.id] ?? 0;

              return (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-4"
                >

                  <div className="flex-1">

                    <p className="text-sm font-medium text-ink">
                      {getProductName(product.name)}
                    </p>

                    <p className="mt-1 text-sm text-gold">
                      {formatPrice(Number(product.price))}
                    </p>

                  </div>

                  <button
                    type="button"
                    aria-label={`Quitar ${getProductName(product.name)}`}
                    onClick={() => setQuantity(product.id, qty - 1)}
                    disabled={qty === 0}
                    className="flex size-8 items-center justify-center border border-hairline text-ink-muted transition-colors hover:text-ink disabled:opacity-30"
                  >
                    <Minus className="size-4" />
                  </button>

                  <span className="w-6 text-center text-sm font-medium text-ink">
                    {qty}
                  </span>

                  <button
                    type="button"
                    aria-label={`Agregar ${getProductName(product.name)}`}
                    onClick={() => setQuantity(product.id, qty + 1)}
                    className="flex size-8 items-center justify-center border border-hairline text-ink-muted transition-colors hover:border-gold hover:text-gold"
                  >
                    <Plus className="size-4" />
                  </button>

                </div>
              );
            })}

          </div>
        </div>
      )}

      {/* PROMOCIONES */}
      <div className="mt-8 space-y-2">

        <Label htmlFor="promo">
          Código de promoción (opcional)
        </Label>

        <Input
          id="promo"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          placeholder="Ej. LUMIERE20"
        />

        <p className="text-xs text-ink-muted">
          Si tienes un código promocional, ingrésalo aquí.
          El descuento será validado al crear la orden.
        </p>

      </div>

      {/* MÉTODO DE PAGO */}
      <div className="mt-8">

        <p className="eyebrow">Método de pago</p>

        <div className="mt-3 grid grid-cols-2 gap-3">

          {(["STRIPE", "PAYPAL"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              className={cn(
                "flex items-center justify-center gap-2 border px-4 py-4 text-sm font-medium transition-colors",
                provider === p
                  ? "border-gold text-gold"
                  : "border-hairline text-ink-muted hover:text-ink",
              )}
            >
              <CreditCard className="size-4" />

              {p === "STRIPE"
                ? "Tarjeta (Stripe)"
                : "PayPal"}
            </button>
          ))}

        </div>

        <p className="mt-3 text-xs leading-relaxed text-ink-muted">
          Este entorno intenta procesar un pago mediante{" "}
          {provider === "STRIPE" ? "Stripe" : "PayPal"}.
          No confirmes la operación hasta verificar que
          las credenciales del proveedor sean de prueba.
        </p>

      </div>

      {/* RESUMEN DE COMPRA */}
      <div className="mt-10 border border-hairline p-5">

        <div className="flex items-center justify-between">
          <h2 className="font-medium text-ink">
            Resumen de compra
          </h2>

          <Ticket className="size-5 text-gold" />
        </div>

        <div className="mt-5 space-y-3">

          {/* ASIENTOS */}
          {mySeats.map((seat) => {
            const price =
              Number(showtime?.basePrice ?? 0) *
              Number(seat.seatType.priceMultiplier);

            const isVip =
              Number(seat.seatType.priceMultiplier) > 1;

            return (
              <div
                key={seat.id}
                className="flex items-center justify-between gap-3 text-sm"
              >

                <span className="text-ink-muted">
                  Asiento {seat.rowLabel}{seat.seatNumber}
                  {isVip ? " (VIP)" : ""}
                </span>

                <span className="text-ink">
                  {formatPrice(price)}
                </span>

              </div>
            );
          })}

          {/* PRODUCTOS */}
          {selectedProducts.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between gap-3 text-sm"
            >

              <span className="text-ink-muted">
                {getProductName(product.name)}
                {product.quantity > 1
                  ? ` x${product.quantity}`
                  : ""}
              </span>

              <span className="text-ink">
                {formatPrice(product.total)}
              </span>

            </div>
          ))}

        </div>

        <div className="mt-5 border-t border-hairline pt-4">

          <div className="flex items-center justify-between">

            <span className="font-medium text-ink">
              Subtotal
            </span>

            <span className="font-display text-xl italic text-ink">
              {formatPrice(subtotal)}
            </span>

          </div>

          {promoCode.trim() && (
            <p className="mt-2 text-xs text-ink-muted">
              Promoción pendiente de validar.
              El total definitivo será calculado por el servidor.
            </p>
          )}

        </div>
      </div>

      {/* TOTAL Y PAGO */}
      <div className="mt-8 flex flex-col gap-5 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <p className="text-xs uppercase tracking-wider text-ink-muted">
            Total estimado
          </p>

          <p className="mt-1 font-display text-3xl italic text-ink">
            {formatPrice(subtotal)}
          </p>
        </div>

        <Button
          size="lg"
          disabled={isSubmitting || !showtime || mySeats.length === 0}
          onClick={() => void handlePay()}
        >
          {isSubmitting
            ? "Procesando..."
            : "Confirmar pago"}
        </Button>

      </div>

    </div>
  );
}
