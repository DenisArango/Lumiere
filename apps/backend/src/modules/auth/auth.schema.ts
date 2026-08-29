import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .regex(/[a-z]/, "La contraseña debe incluir al menos una minúscula")
  .regex(/[A-Z]/, "La contraseña debe incluir al menos una mayúscula")
  .regex(/[0-9]/, "La contraseña debe incluir al menos un número");

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: passwordSchema,
  firstName: z.string().trim().min(1, "El nombre es requerido").max(100),
  lastName: z.string().trim().min(1, "El apellido es requerido").max(100),
  phone: z.string().trim().min(7).max(20).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
