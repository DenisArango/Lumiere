import { apiClient } from "@/lib/api-client";
import type { CreateProductInput, Product } from "@/features/products/products.types";

export async function fetchProducts(): Promise<Product[]> {
  const { data } = await apiClient.get<{ products: Product[] }>("/products");
  return data.products;
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const { data } = await apiClient.post<{ product: Product }>("/products", input);
  return data.product;
}
