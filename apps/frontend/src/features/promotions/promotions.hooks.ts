import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPromotion,
  fetchPromotionById,
  fetchPromotions,
  fetchPromotionsAdmin,
  updatePromotion,
} from "@/features/promotions/promotions.api";
import type { CreatePromotionInput, UpdatePromotionInput } from "@/features/promotions/promotions.types";

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

export function usePromotionsAdmin() {
  return useQuery({ queryKey: ["promotions", "admin"], queryFn: fetchPromotionsAdmin });
}

export function usePromotion(id: string | undefined) {
  return useQuery({
    queryKey: ["promotion", id],
    queryFn: () => fetchPromotionById(id as string),
    enabled: Boolean(id),
  });
}

export function useUpdatePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePromotionInput }) => updatePromotion(id, input),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ["promotions"] });
      void queryClient.invalidateQueries({ queryKey: ["promotion", id] });
    },
  });
}
