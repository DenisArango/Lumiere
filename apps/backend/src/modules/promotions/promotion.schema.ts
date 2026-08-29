import { z } from "zod";
import { DiscountType } from "@prisma/client";

const ruleSchema = z
  .object({
    movieId: z.string().uuid().optional(),
    cinemaId: z.string().uuid().optional(),
    dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  })
  .refine((r) => r.movieId ?? r.cinemaId ?? r.dayOfWeek !== undefined, {
    message: "Cada regla debe tener al menos un criterio (película, cine o día de la semana)",
  });

export const createPromotionSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    description: z.string().trim().max(1000).optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3)
      .max(30)
      .regex(/^[A-Z0-9_-]+$/, "El código solo puede tener letras, números, guiones y guion bajo"),
    discountType: z.nativeEnum(DiscountType),
    discountValue: z.coerce.number().positive(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    isActive: z.boolean().default(true),
    rules: z.array(ruleSchema).default([]),
  })
  .refine((p) => p.endDate > p.startDate, {
    message: "endDate debe ser posterior a startDate",
    path: ["endDate"],
  })
  .refine((p) => p.discountType !== DiscountType.PERCENTAGE || p.discountValue <= 100, {
    message: "Un descuento porcentual no puede ser mayor a 100",
    path: ["discountValue"],
  });

export const updatePromotionSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(1000).optional(),
  discountValue: z.coerce.number().positive().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
  rules: z.array(ruleSchema).optional(),
});

export const validatePromotionSchema = z.object({
  code: z.string().trim().toUpperCase().min(1),
  showtimeId: z.string().uuid(),
});

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;
export type ValidatePromotionInput = z.infer<typeof validatePromotionSchema>;
