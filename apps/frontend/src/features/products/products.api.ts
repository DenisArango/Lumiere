import { apiClient } from "@/lib/api-client";
import type { CreateProductInput, Product, UpdateProductInput } from "@/features/products/products.types";

export async function fetchProducts(): Promise<Product[]> {
  const { data } = await apiClient.get<{ products: Product[] }>("/products");
  return data.products;
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const { data } = await apiClient.post<{ product: Product }>("/products", input);
  return data.product;
}

/** Panel: incluye productos desactivados para poder reactivarlos (requiere rol de staff). */
export async function fetchProductsAdmin(): Promise<Product[]> {
  const { data } = await apiClient.get<{ products: Product[] }>("/products", {
    params: { includeInactive: true },
  });
  return data.products;
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
  const { data } = await apiClient.patch<{ product: Product }>(`/products/${id}`, input);
  return data.product;
}
