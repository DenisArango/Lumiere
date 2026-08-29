import { z } from "zod";
import { paginationSchema } from "@/utils/pagination";

export const lockSeatsSchema = z.object({
  seatIds: z.array(z.string().uuid()).min(1).max(10, "Máximo 10 butacas por operación"),
});

export const releaseSeatsSchema = z.object({
  seatIds: z.array(z.string().uuid()).min(1),
});

export const createOrderSchema = z.object({
  showtimeId: z.string().uuid(),
  seatIds: z.array(z.string().uuid()).min(1).max(10),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().positive().max(20),
      }),
    )
    .optional(),
  promotionCode: z.string().trim().toUpperCase().min(1).optional(),
});

export const listOrdersQuerySchema = paginationSchema;

export type LockSeatsInput = z.infer<typeof lockSeatsSchema>;
export type ReleaseSeatsInput = z.infer<typeof releaseSeatsSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
