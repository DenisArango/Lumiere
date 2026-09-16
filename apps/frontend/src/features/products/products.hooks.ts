import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProduct, fetchProducts } from "@/features/products/products.api";
import type { CreateProductInput } from "@/features/products/products.types";

export function useProducts() {
  return useQuery({ queryKey: ["products"], queryFn: fetchProducts, staleTime: 60 * 1000 });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProductInput) => createProduct(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}
