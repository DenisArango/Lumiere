import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProduct,
  fetchProducts,
  fetchProductsAdmin,
  updateProduct,
} from "@/features/products/products.api";
import type { CreateProductInput, UpdateProductInput } from "@/features/products/products.types";

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

export function useProductsAdmin() {
  return useQuery({ queryKey: ["products", "admin"], queryFn: fetchProductsAdmin });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) => updateProduct(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}
