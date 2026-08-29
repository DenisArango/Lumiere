import { z } from "zod";

export const promotionFormSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es requerido").max(150),
    description: z.string().trim().max(1000).optional().or(z.literal("")),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, "Mínimo 3 caracteres")
      .max(30)
      .regex(/^[A-Z0-9_-]+$/, "Solo letras, números, guiones y guion bajo"),
    discountType: z.enum(["PERCENTAGE", "FIXED"]),
    discountValue: z.coerce.number().positive("Debe ser mayor a 0"),
    startDate: z.string().min(1, "Selecciona una fecha de inicio"),
    endDate: z.string().min(1, "Selecciona una fecha de fin"),
    isActive: z.boolean(),
  })
  .refine((p) => new Date(p.endDate) > new Date(p.startDate), {
    message: "La fecha de fin debe ser posterior a la de inicio",
    path: ["endDate"],
  })
  .refine((p) => p.discountType !== "PERCENTAGE" || p.discountValue <= 100, {
    message: "Un descuento porcentual no puede ser mayor a 100",
    path: ["discountValue"],
  });

export type PromotionFormValues = z.infer<typeof promotionFormSchema>;
