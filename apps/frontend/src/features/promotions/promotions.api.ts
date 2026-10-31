import { apiClient } from "@/lib/api-client";
import type { CreatePromotionInput, Promotion, UpdatePromotionInput } from "@/features/promotions/promotions.types";

export async function fetchPromotions(): Promise<Promotion[]> {
  const { data } = await apiClient.get<{ promotions: Promotion[] }>("/promotions");
  return data.promotions;
}

export async function createPromotion(input: CreatePromotionInput): Promise<Promotion> {
  const { data } = await apiClient.post<{ promotion: Promotion }>("/promotions", input);
  return data.promotion;
}

export async function validatePromotion(
  code: string,
  showtimeId: string,
): Promise<Promotion> {
  const { data } = await apiClient.post<{ promotion: Promotion }>(
    "/promotions/validate",
    {
      code,
      showtimeId,
    },
  );

  return data.promotion;
}

/** Panel: todas las promociones, incluso vencidas o desactivadas (requiere rol de staff). */
export async function fetchPromotionsAdmin(): Promise<Promotion[]> {
  const { data } = await apiClient.get<{ promotions: Promotion[] }>("/promotions", {
    params: { includeInactive: true },
  });
  return data.promotions;
}

export async function fetchPromotionById(id: string): Promise<Promotion> {
  const { data } = await apiClient.get<{ promotion: Promotion }>(`/promotions/${id}`);
  return data.promotion;
}

export async function updatePromotion(id: string, input: UpdatePromotionInput): Promise<Promotion> {
  const { data } = await apiClient.patch<{ promotion: Promotion }>(`/promotions/${id}`, input);
  return data.promotion;
}
