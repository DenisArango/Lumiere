import { z } from "zod";
import { Role } from "@prisma/client";
import { paginationSchema } from "@/utils/pagination";
import { passwordSchema } from "@/modules/auth/auth.schema";

export const listUsersQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: passwordSchema,
  firstName: z.string().trim().min(1, "El nombre es requerido").max(100),
  lastName: z.string().trim().min(1, "El apellido es requerido").max(100),
  phone: z.string().trim().min(7).max(20).optional(),
  role: z.nativeEnum(Role),
});

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
