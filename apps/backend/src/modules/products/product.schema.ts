import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(150),
  description: z.string().trim().max(500).optional(),
  price: z.coerce.number().positive("El precio debe ser mayor a 0"),
  imageUrl: z.string().trim().url("URL inválida").optional(),
  isActive: z.boolean().default(true),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
