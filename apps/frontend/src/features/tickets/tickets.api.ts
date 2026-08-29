import { apiClient } from "@/lib/api-client";
import type { ValidatedTicket } from "@/features/tickets/tickets.types";

export async function validateTicket(qrCode: string): Promise<ValidatedTicket> {
  const { data } = await apiClient.post<{ order: ValidatedTicket }>("/tickets/validate", { qrCode });
  return data.order;
}
