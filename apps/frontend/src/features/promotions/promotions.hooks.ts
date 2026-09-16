import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPromotion, fetchPromotions } from "@/features/promotions/promotions.api";
import type { CreatePromotionInput } from "@/features/promotions/promotions.types";

export function usePromotions() {
  return useQuery({ queryKey: ["promotions"], queryFn: fetchPromotions });
}

export function useCreatePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePromotionInput) => createPromotion(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["promotions"] }),
  });
}
