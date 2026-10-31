import { useQuery } from "@tanstack/react-query";
import { fetchPaymentConfig } from "@/features/payments/payments.api";

/** Que proveedores estan disponibles, moneda y reglas del canje de puntos. Cambia solo con un despliegue. */
export function usePaymentConfig() {
  return useQuery({ queryKey: ["payment-config"], queryFn: fetchPaymentConfig, staleTime: 10 * 60 * 1000 });
}
