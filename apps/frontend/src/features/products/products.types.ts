export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  isActive: boolean;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isActive: boolean;
}
