import { apiClient } from "@/lib/api-client";
import type { CreatePromotionInput, Promotion } from "@/features/promotions/promotions.types";

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
