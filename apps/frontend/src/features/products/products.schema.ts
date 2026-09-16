import { z } from "zod";

export const productFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(150),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  price: z.coerce.number().positive("El precio debe ser mayor a 0"),
  imageUrl: z.string().trim().url("URL inválida").optional().or(z.literal("")),
  isActive: z.boolean(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
