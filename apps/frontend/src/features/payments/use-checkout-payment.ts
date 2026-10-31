import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Stripe, StripeCardElement } from "@stripe/stripe-js";
import { useAuthStore } from "@/features/auth/auth.store";
import { cancelOrder, createOrder, lockSeats } from "@/features/bookings/bookings.api";
import type { Order } from "@/features/bookings/bookings.types";
import { confirmPayment, createCheckoutSession, payOrder } from "@/features/payments/payments.api";

export interface CheckoutInput {
  showtimeId: string;
  seatIds: string[];
  promotionCode?: string;
  items?: { productId: string; quantity: number }[];
  redeemPoints?: number;
}

/** Error con mensaje ya listo para mostrar al cliente (tarjeta rechazada, autenticacion no completada...). */
export class PaymentUiError extends Error {}

/**
 * Ciclo de vida de una compra en el checkout.
 *
 * - La orden se crea UNA vez y se reutiliza si el pago falla y el cliente reintenta: antes cada clic en
 *   "Pagar" creaba otra orden y la segunda fallaba porque las butacas ya estaban en la primera.
 * - Mientras la orden existe, el contenido de la compra (puntos, promo, combos) queda congelado porque el
 *   servidor ya fijo el total. `resetOrder` la cancela y vuelve a bloquear las butacas para editarla.
 */
export function useCheckoutPayment(input: CheckoutInput | null) {
  const navigate = useNavigate();
  // El ref guarda la ultima entrada para que los callbacks (que no cambian) siempre lean la actual.
  const inputRef = useRef(input);
  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  const orderRef = useRef<Order | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const ensureOrder = useCallback(async (): Promise<Order> => {
    if (orderRef.current) return orderRef.current;
    const current = inputRef.current;
    if (!current) throw new PaymentUiError("Falta la información de la compra");
    const created = await createOrder(current);
    orderRef.current = created;
    setOrder(created);
    return created;
  }, []);

  const resetOrder = useCallback(async () => {
    const existing = orderRef.current;
    const current = inputRef.current;
    if (!existing || !current) return;
    await cancelOrder(existing.id);
    // Cancelar libera las butacas: se vuelven a bloquear para que el cliente siga con su compra.
    await lockSeats(current.showtimeId, current.seatIds);
    orderRef.current = null;
    setOrder(null);
  }, []);

  const finish = useCallback(
    (paid: Order) => {
      void useAuthStore.getState().refreshUser();
      navigate("/confirmacion", { state: { order: paid }, replace: true });
    },
    [navigate],
  );

  /** Tarjeta (Stripe). Si el banco pide 3D Secure, se completa en un modal y luego el servidor lo verifica con Stripe. */
  const payWithCard = useCallback(
    async (stripe: Stripe, card: StripeCardElement) => {
      setIsProcessing(true);
      try {
        // La tarjeta viaja del navegador directo a Stripe; al backend solo llega el id del PaymentMethod (pm_...).
        // Se tokeniza ANTES de crear la orden: un error de tarjeta no deja ordenes colgadas.
        const { paymentMethod, error } = await stripe.createPaymentMethod({ type: "card", card });
        if (error || !paymentMethod) {
          throw new PaymentUiError(error?.message ?? "Revisa los datos de tu tarjeta");
        }

        const created = await ensureOrder();
        const result = await payOrder(created.id, "STRIPE", paymentMethod.id);

        let paid = result.order;
        if (result.action) {
          const { error: actionError } = await stripe.handleNextAction({ clientSecret: result.action.clientSecret });
          if (actionError) {
            throw new PaymentUiError(actionError.message ?? "No se completó la autenticación de tu banco");
          }
          paid = await confirmPayment(created.id, result.action.paymentIntentId);
        }

        finish(paid);
      } finally {
        setIsProcessing(false);
      }
    },
    [ensureOrder, finish],
  );

  /** PayPal, paso 1: el SERVIDOR crea la orden de PayPal con el total de nuestra orden. Devuelve su id al boton. */
  const createPayPalOrder = useCallback(async (): Promise<string> => {
    const created = await ensureOrder();
    const session = await createCheckoutSession(created.id, "PAYPAL");
    return session.providerOrderId;
  }, [ensureOrder]);

  /** PayPal, paso 2: el cliente aprobo en la ventana de PayPal; el servidor captura y verifica monto y orden. */
  const approvePayPal = useCallback(
    async (paypalOrderId: string) => {
      setIsProcessing(true);
      try {
        const created = await ensureOrder();
        const result = await payOrder(created.id, "PAYPAL", paypalOrderId);
        finish(result.order);
      } finally {
        setIsProcessing(false);
      }
    },
    [ensureOrder, finish],
  );

  return {
    order,
    hasOrder: order !== null,
    /** Para el aviso de "liberar butacas al salir": solo si todavia no hay orden. */
    orderRef,
    isProcessing,
    payWithCard,
    createPayPalOrder,
    approvePayPal,
    resetOrder,
  };
}
