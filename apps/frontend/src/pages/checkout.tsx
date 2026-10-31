import { useMemo, useState } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { CreditCard, Lock, Minus, Pencil, Plus, ShoppingBag, Sparkles, Tag, Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PayPalCheckout } from "@/components/paypal-checkout";

import { useShowtime } from "@/features/showtimes/showtimes.hooks";
import { useSeatMap, useReleaseSeats } from "@/features/bookings/bookings.hooks";
import { useProducts } from "@/features/products/products.hooks";
import { useAuthStore } from "@/features/auth/auth.store";
import { validatePromotion } from "@/features/promotions/promotions.api";
import type { Promotion } from "@/features/promotions/promotions.types";
import { usePaymentConfig } from "@/features/payments/payments.hooks";
import { PaymentUiError, useCheckoutPayment } from "@/features/payments/use-checkout-payment";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatMoney, formatNumber } from "@/lib/format";
import { getStripe, isTestKey } from "@/lib/stripe";
import { useEffectOnUnmount } from "@/lib/use-effect-on-unmount";
import { cn } from "@/lib/utils";

interface CheckoutState {
  showtimeId: string;
  seatIds: string[];
}

type Provider = "STRIPE" | "PAYPAL";

function getProductName(name: string) {
  if (name.trim().toLowerCase() === "combo lumiere") {
    return "Combo de palomitas Lumière";
  }
  return name;
}

/** Descuento estimado de una promocion ya validada. El total definitivo siempre lo calcula el servidor. */
function estimateDiscount(promotion: Promotion, subtotal: number): number {
  const value = Number(promotion.discountValue);
  const raw = promotion.discountType === "PERCENTAGE" ? (subtotal * value) / 100 : value;
  return Math.min(raw, subtotal);
}

/** Colores de la tarjeta de Stripe: leen las variables CSS del tema vigente (claro/oscuro). */
function cardStyle() {
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue("--lumiere-text-primary").trim() || "#f5f1e8";
  const muted = css.getPropertyValue("--lumiere-text-secondary").trim() || "#a8a6b0";
  const danger = css.getPropertyValue("--lumiere-danger").trim() || "#c24b4b";
  return {
    base: { color: ink, fontSize: "16px", fontFamily: "Inter, sans-serif", "::placeholder": { color: muted } },
    invalid: { color: danger },
  };
}

/** Stripe Elements necesita su contexto por encima de quien llama a useStripe()/useElements(). */
export function CheckoutPage() {
  const { data: config } = usePaymentConfig();
  const publishableKey = config?.stripe.publishableKey;
  // null mientras llega la configuracion: Elements admite pasar de null a Stripe una sola vez.
  const stripePromise = useMemo(() => (publishableKey ? getStripe(publishableKey) : null), [publishableKey]);

  return (
    <Elements stripe={stripePromise}>
      <CheckoutContent />
    </Elements>
  );
}

function CheckoutContent() {
  const stripe = useStripe();
  const elements = useElements();
  const location = useLocation();
  const state = location.state as CheckoutState | null;

  const user = useAuthStore((s) => s.user);
  const { data: config } = usePaymentConfig();
  const { data: showtime } = useShowtime(state?.showtimeId);
  const { data: seatMap } = useSeatMap(state?.showtimeId);
  const { data: products } = useProducts();
  const releaseMutation = useReleaseSeats(state?.showtimeId ?? "");

  const [provider, setProvider] = useState<Provider>("STRIPE");
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [redeemPoints, setRedeemPoints] = useState(0);

  const items = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([productId, quantity]) => ({ productId, quantity })),
    [quantities],
  );

  const payment = useCheckoutPayment(
    state
      ? {
          showtimeId: state.showtimeId,
          seatIds: state.seatIds,
          promotionCode: promoCode.trim() || undefined,
          items: items.length > 0 ? items : undefined,
          redeemPoints: redeemPoints > 0 ? redeemPoints : undefined,
        }
      : null,
  );
  const { hasOrder, order, isProcessing } = payment;

  // Si el cliente se va sin orden, las butacas que reservo se liberan. Con una orden creada se conservan hasta que expire.
  useEffectOnUnmount(() => {
    if (!payment.orderRef.current && state) {
      void releaseMutation.mutateAsync(state.seatIds);
    }
  });

  if (!state) {
    return <Navigate to="/" replace />;
  }

  const mySeats = seatMap?.filter((seat) => state.seatIds.includes(seat.id)) ?? [];

  const seatsSubtotal = showtime
    ? mySeats.reduce((sum, seat) => sum + Number(showtime.basePrice) * Number(seat.seatType.priceMultiplier), 0)
    : 0;

  const selectedProducts = (products ?? [])
    .filter((product) => (quantities[product.id] ?? 0) > 0)
    .map((product) => ({
      ...product,
      quantity: quantities[product.id] ?? 0,
      total: Number(product.price) * (quantities[product.id] ?? 0),
    }));
  const itemsSubtotal = selectedProducts.reduce((sum, product) => sum + product.total, 0);
  const subtotal = seatsSubtotal + itemsSubtotal;

  const promoDiscount = appliedPromo ? estimateDiscount(appliedPromo, subtotal) : 0;
  const payableBeforePoints = subtotal - promoDiscount;

  // Canje de puntos: mismas reglas que el servidor (el servidor las vuelve a verificar).
  const unit = config?.loyalty.pointsPerDiscountUnit ?? 10;
  const share = config?.loyalty.maxRedeemShare ?? 0.5;
  const isMember = Boolean(user?.loyaltyMember);
  const maxRedeemUnits = isMember
    ? Math.max(0, Math.min(Math.floor((user?.loyaltyPoints ?? 0) / unit), Math.floor(payableBeforePoints * share)))
    : 0;
  const maxRedeemPoints = maxRedeemUnits * unit;
  const effectiveRedeem = Math.min(redeemPoints, maxRedeemPoints);
  const pointsDiscount = effectiveRedeem / unit;

  const estimatedTotal = Math.max(0, payableBeforePoints - pointsDiscount);
  // Con la orden creada, el total es el que fijo el servidor.
  const total = order ? Number(order.totalAmount) : estimatedTotal;
  const pointsToEarn = isMember ? Math.floor(total) : 0;

  const stripeAvailable = Boolean(config?.stripe.enabled && config.stripe.publishableKey);
  const isStripeTestMode = isTestKey(config?.stripe.publishableKey);
  const paypalAvailable = Boolean(config?.paypal.enabled && config.paypal.clientId);
  const paypalConverts = Boolean(config && config.paypal.currency !== config.currency && config.paypal.rate);
  const paypalAmount = paypalConverts && config?.paypal.rate ? total / config.paypal.rate : total;
  // Stripe tambien puede cobrar en otra moneda (la de la cuenta): el cliente ve en quetzales y se le cobra convertido.
  const cardConverts = Boolean(config && config.stripe.currency !== config.currency && config.stripe.rate);
  const cardAmount = cardConverts && config?.stripe.rate ? total / config.stripe.rate : total;

  function setQuantity(productId: string, next: number) {
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(0, next) }));
  }

  async function applyPromo() {
    const code = promoCode.trim();
    if (!code) return;
    setIsValidatingPromo(true);
    try {
      const promotion = await validatePromotion(code, state!.showtimeId);
      setAppliedPromo(promotion);
      toast.success(`Promoción aplicada: ${promotion.name}`);
    } catch (error) {
      setAppliedPromo(null);
      toast.error(getApiErrorMessage(error, "Ese código no es válido para esta función"));
    } finally {
      setIsValidatingPromo(false);
    }
  }

  async function editPurchase() {
    try {
      await payment.resetOrder();
      toast.message("Ya puedes cambiar tu compra");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos reabrir tu compra"));
    }
  }

  async function handlePayCard() {
    if (!stripe || !elements) return;
    const card = elements.getElement(CardElement);
    if (!card) {
      toast.error("No pudimos leer los datos de la tarjeta");
      return;
    }
    try {
      await payment.payWithCard(stripe, card);
    } catch (error) {
      toast.error(error instanceof PaymentUiError ? error.message : getApiErrorMessage(error, "No pudimos procesar tu pago"));
    }
  }

  const locked = hasOrder || isProcessing;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Un paso más</p>
      <h1 className="mt-1 font-display text-4xl italic text-ink">Confirma tu compra</h1>
      <p className="mt-2 text-sm text-ink-muted">Revisa los detalles antes de pagar. Tus butacas están reservadas por unos minutos.</p>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px]">
        <div className="space-y-10">
          {hasOrder && (
            <div className="flex flex-wrap items-center justify-between gap-3 border border-gold/50 bg-surface px-4 py-3 text-sm">
              <p className="text-ink">Tu compra está lista para pagar. Para cambiarla, reábrela.</p>
              <Button size="sm" variant="outline" onClick={() => void editPurchase()} disabled={isProcessing}>
                <Pencil className="size-3.5" /> Editar compra
              </Button>
            </div>
          )}

          {/* DULCERÍA */}
          {products && products.length > 0 && (
            <section aria-labelledby="dulceria">
              <div className="flex items-center gap-2">
                <ShoppingBag className="size-4 text-gold" />
                <h2 id="dulceria" className="eyebrow">
                  Dulcería (opcional)
                </h2>
              </div>
              <p className="mt-2 text-sm text-ink-muted">Acompaña tu película con tus productos favoritos.</p>

              <div className="mt-4 divide-y divide-hairline border border-hairline">
                {products.map((product) => {
                  const qty = quantities[product.id] ?? 0;
                  return (
                    <div key={product.id} className="flex items-center gap-3 p-4">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-ink">{getProductName(product.name)}</p>
                        {product.description && <p className="mt-0.5 text-xs text-ink-muted">Incluye: {product.description}</p>}
                        <p className="mt-1 text-sm text-gold">{formatMoney(product.price)}</p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Quitar ${getProductName(product.name)}`}
                        onClick={() => setQuantity(product.id, qty - 1)}
                        disabled={qty === 0 || locked}
                        className="flex size-8 items-center justify-center border border-hairline text-ink-muted transition-colors hover:text-ink disabled:opacity-30"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span className="w-6 text-center text-sm font-medium text-ink" aria-live="polite">
                        {qty}
                      </span>
                      <button
                        type="button"
                        aria-label={`Agregar ${getProductName(product.name)}`}
                        onClick={() => setQuantity(product.id, qty + 1)}
                        disabled={locked}
                        className="flex size-8 items-center justify-center border border-hairline text-ink-muted transition-colors hover:border-gold hover:text-gold disabled:opacity-30"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* PROMOCIONES */}
          <section aria-labelledby="promo-title" className="space-y-2">
            <div className="flex items-center gap-2">
              <Tag className="size-4 text-gold" />
              <h2 id="promo-title" className="eyebrow">
                Código de promoción (opcional)
              </h2>
            </div>
            <div className="flex gap-2">
              <Input
                id="promo"
                aria-label="Código de promoción"
                value={promoCode}
                disabled={locked}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => {
                  setPromoCode(e.target.value.toUpperCase());
                  setAppliedPromo(null);
                }}
                placeholder="Ej. LUMIERE20…"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void applyPromo()}
                disabled={locked || isValidatingPromo || promoCode.trim() === ""}
              >
                {isValidatingPromo ? "Validando…" : "Aplicar"}
              </Button>
            </div>
            {appliedPromo && (
              <p className="text-xs text-success">
                {appliedPromo.name}: descuento estimado de {formatMoney(promoDiscount)}. El total final lo confirma el servidor.
              </p>
            )}
          </section>

          {/* PUNTOS */}
          <section aria-labelledby="points-title" className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-gold" />
              <h2 id="points-title" className="eyebrow">
                Lumière Club
              </h2>
            </div>
            {isMember ? (
              maxRedeemPoints >= unit ? (
                <div className="border border-hairline p-4">
                  <p className="text-sm text-ink">
                    Tienes <strong>{formatNumber(user?.loyaltyPoints ?? 0)} puntos</strong>. {unit} puntos = {formatMoney(1)} de descuento, hasta la
                    mitad de tu compra.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      aria-label="Puntos a canjear"
                      className="w-32"
                      min={0}
                      max={maxRedeemPoints}
                      step={unit}
                      value={redeemPoints}
                      disabled={locked}
                      onChange={(e) => {
                        const raw = Math.max(0, Math.floor(Number(e.target.value) || 0));
                        setRedeemPoints(Math.min(maxRedeemPoints, Math.floor(raw / unit) * unit));
                      }}
                    />
                    <Button type="button" size="sm" variant="outline" disabled={locked} onClick={() => setRedeemPoints(maxRedeemPoints)}>
                      Usar el máximo ({formatNumber(maxRedeemPoints)})
                    </Button>
                    {redeemPoints > 0 && (
                      <Button type="button" size="sm" variant="ghost" disabled={locked} onClick={() => setRedeemPoints(0)}>
                        Quitar
                      </Button>
                    )}
                  </div>
                  {effectiveRedeem > 0 && (
                    <p className="mt-2 text-xs text-gold">
                      Canjearás {formatNumber(effectiveRedeem)} puntos y ahorrarás {formatMoney(pointsDiscount)}.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-ink-muted">
                  Tienes {formatNumber(user?.loyaltyPoints ?? 0)} puntos. Con {unit} o más puedes canjearlos por descuento en una compra.
                </p>
              )
            ) : (
              <p className="text-sm text-ink-muted">
                {user
                  ? "Únete al Lumière Club desde “Mis boletos” para sumar puntos con cada compra y canjearlos."
                  : "Inicia sesión para sumar puntos con esta compra."}
              </p>
            )}
          </section>

          {/* MÉTODO DE PAGO */}
          <section aria-labelledby="pay-title">
            <h2 id="pay-title" className="eyebrow">
              Método de pago
            </h2>

            <div className="mt-3 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Método de pago">
              {(["STRIPE", "PAYPAL"] as const).map((p) => {
                const available = p === "STRIPE" ? stripeAvailable : paypalAvailable;
                return (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={provider === p}
                    disabled={!available || isProcessing}
                    onClick={() => setProvider(p)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 border px-4 py-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      provider === p ? "border-gold text-gold" : "border-hairline text-ink-muted hover:text-ink",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <CreditCard className="size-4" />
                      {p === "STRIPE" ? "Tarjeta" : "PayPal"}
                    </span>
                    {!available && <span className="text-[0.6875rem] font-normal">No disponible</span>}
                  </button>
                );
              })}
            </div>

            {provider === "STRIPE" && stripeAvailable && (
              <div className="mt-4">
                <Label htmlFor="card-element">Datos de la tarjeta</Label>
                <div id="card-element" className="mt-1.5 border border-hairline bg-surface px-3 py-3.5">
                  <CardElement options={{ style: cardStyle(), hidePostalCode: true }} />
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs leading-relaxed text-ink-muted">
                  <Lock className="size-3 shrink-0" /> Tu tarjeta se procesa directamente en Stripe; Lumière nunca ve ni guarda el número.
                </p>
                {cardConverts && config?.stripe.rate && (
                  <p className="mt-2 border border-hairline px-3 py-2 text-xs leading-relaxed text-ink-muted">
                    Tu tarjeta se cobra en {config.stripe.currency}: aproximadamente{" "}
                    {new Intl.NumberFormat("es-MX", { style: "currency", currency: config.stripe.currency }).format(cardAmount)} (tipo de cambio fijo de{" "}
                    {formatMoney(config.stripe.rate)} por 1 {config.stripe.currency}). Tu banco puede mostrar el cargo con su propia conversión.
                  </p>
                )}
                {isStripeTestMode && (
                  <p className="mt-2 border border-gold/40 px-3 py-2 text-xs leading-relaxed text-gold">
                    Modo de prueba: usa la tarjeta 4242 4242 4242 4242, cualquier fecha futura y cualquier CVC. Para probar 3D Secure usa 4000
                    0027 6000 3184. No se cobra dinero real.
                  </p>
                )}
              </div>
            )}

            {provider === "PAYPAL" && paypalAvailable && (
              <p className="mt-4 border border-hairline px-3 py-2 text-xs leading-relaxed text-ink-muted">
                {paypalConverts && config?.paypal.rate
                  ? `PayPal cobra en ${config.paypal.currency}: se te cobrarán aproximadamente ${new Intl.NumberFormat("es", { style: "currency", currency: config.paypal.currency }).format(paypalAmount)} (tipo de cambio fijo de ${formatMoney(config.paypal.rate)} por 1 ${config.paypal.currency}).`
                  : "Pagarás en la ventana segura de PayPal."}
              </p>
            )}
          </section>
        </div>

        {/* TALÓN DE BOLETO: resumen y pago, siempre a la vista */}
        <aside aria-label="Resumen de compra" className="lg:sticky lg:top-6 lg:self-start">
          <div className="relative border border-hairline bg-surface">
            <div className="p-5">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Admite {mySeats.length || state.seatIds.length}</p>
                <Ticket className="size-5 text-gold" />
              </div>
              <h2 className="mt-3 font-display text-2xl italic leading-tight text-ink">{showtime?.movie.title ?? "Cargando…"}</h2>
              {showtime && (
                <p className="mt-2 text-sm text-ink-muted">
                  {showtime.room.cinema.name} · {showtime.room.name}
                  <br />
                  {new Date(showtime.startTime).toLocaleString("es-GT", { dateStyle: "long", timeStyle: "short" })}
                </p>
              )}
              <p className="mt-2 text-sm font-medium text-ink">
                {mySeats.length === 1 ? "Butaca" : "Butacas"}: {mySeats.map((seat) => `${seat.rowLabel}${seat.seatNumber}`).join(", ") || "—"}
              </p>
            </div>

            {/* Perforación del talón */}
            <div className="relative h-px border-t border-dashed border-hairline">
              <span aria-hidden className="absolute -left-2 -top-2 size-4 rounded-full border border-hairline bg-base" />
              <span aria-hidden className="absolute -right-2 -top-2 size-4 rounded-full border border-hairline bg-base" />
            </div>

            <div className="space-y-2 p-5 text-sm">
              {mySeats.map((seat) => {
                const price = Number(showtime?.basePrice ?? 0) * Number(seat.seatType.priceMultiplier);
                return (
                  <div key={seat.id} className="flex items-center justify-between gap-3">
                    <span className="text-ink-muted">
                      Butaca {seat.rowLabel}
                      {seat.seatNumber}
                      {Number(seat.seatType.priceMultiplier) > 1 ? " (VIP)" : ""}
                    </span>
                    <span className="text-ink">{formatMoney(price)}</span>
                  </div>
                );
              })}
              {selectedProducts.map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-3">
                  <span className="text-ink-muted">
                    {getProductName(product.name)}
                    {product.quantity > 1 ? ` x${product.quantity}` : ""}
                  </span>
                  <span className="text-ink">{formatMoney(product.total)}</span>
                </div>
              ))}
              {promoDiscount > 0 && !order && (
                <div className="flex items-center justify-between gap-3 text-success">
                  <span>Promoción (est.)</span>
                  <span>−{formatMoney(promoDiscount)}</span>
                </div>
              )}
              {pointsDiscount > 0 && !order && (
                <div className="flex items-center justify-between gap-3 text-gold">
                  <span>Puntos canjeados</span>
                  <span>−{formatMoney(pointsDiscount)}</span>
                </div>
              )}
              {order && Number(order.discountAmount) > 0 && (
                <div className="flex items-center justify-between gap-3 text-success">
                  <span>Descuentos</span>
                  <span>−{formatMoney(order.discountAmount)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-hairline p-5">
              <div className="flex items-end justify-between">
                <span className="text-xs uppercase tracking-wider text-ink-muted">{order ? "Total a pagar" : "Total estimado"}</span>
                <span className="font-display text-3xl italic text-ink" aria-live="polite">
                  {formatMoney(total)}
                </span>
              </div>
              {pointsToEarn > 0 && <p className="mt-1 text-right text-xs text-gold">Sumarás {formatNumber(pointsToEarn)} puntos</p>}

              <div className="mt-5">
                {provider === "STRIPE" ? (
                  <Button
                    size="lg"
                    className="w-full"
                    disabled={isProcessing || !showtime || mySeats.length === 0 || !stripe || !stripeAvailable}
                    onClick={() => void handlePayCard()}
                  >
                    {isProcessing ? "Procesando…" : `Pagar ${formatMoney(total)}`}
                  </Button>
                ) : paypalAvailable && config?.paypal.clientId ? (
                  <PayPalCheckout
                    clientId={config.paypal.clientId}
                    currency={config.paypal.currency}
                    disabled={isProcessing || !showtime || mySeats.length === 0}
                    createOrder={payment.createPayPalOrder}
                    onApprove={payment.approvePayPal}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
