import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/api-client";

interface PayPalCheckoutProps {
  clientId: string;
  /** Moneda en la que PayPal cobra (puede diferir de la de la tienda). */
  currency: string;
  disabled?: boolean;
  /** Crea la orden de PayPal EN EL SERVIDOR y devuelve su id. */
  createOrder: () => Promise<string>;
  /** El cliente aprobo en PayPal: el servidor captura y verifica. */
  onApprove: (paypalOrderId: string) => Promise<void>;
}

/**
 * Botones de PayPal. El monto nunca sale del navegador: `createOrder` le pide al backend que cree la orden
 * de PayPal con el total de nuestra orden, y al aprobar, el backend vuelve a verificar monto y orden antes
 * de capturar.
 */
export function PayPalCheckout({ clientId, currency, disabled, createOrder, onApprove }: PayPalCheckoutProps) {
  return (
    <PayPalScriptProvider options={{ clientId, currency, intent: "capture", locale: "es_MX" }}>
      <PayPalButtons
        style={{ layout: "vertical", shape: "rect", color: "gold", label: "pay", height: 48 }}
        disabled={disabled}
        createOrder={async () => {
          try {
            return await createOrder();
          } catch (error) {
            toast.error(getApiErrorMessage(error, "No pudimos iniciar el pago con PayPal"));
            throw error;
          }
        }}
        onApprove={async (data) => {
          try {
            await onApprove(data.orderID);
          } catch (error) {
            toast.error(getApiErrorMessage(error, "No pudimos completar tu pago con PayPal"));
          }
        }}
        onCancel={() => toast.message("Cancelaste el pago en PayPal. Tu compra sigue lista cuando quieras pagar.")}
        onError={() => toast.error("PayPal tuvo un problema. Intenta de nuevo o paga con tarjeta.")}
      />
    </PayPalScriptProvider>
  );
}
