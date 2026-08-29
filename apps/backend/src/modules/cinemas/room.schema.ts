import { z } from "zod";
import { RoomType } from "@prisma/client";

const rowSchema = z.object({
  rowLabel: z.string().trim().min(1).max(5),
  seatCount: z.coerce.number().int().positive().max(60),
  seatTypeId: z.string().uuid(),
});

export const createRoomSchema = z.object({
  name: z.string().trim().min(1).max(50),
  roomType: z.nativeEnum(RoomType).default(RoomType.STANDARD),
  rows: z
    .array(rowSchema)
    .min(1, "La sala debe tener al menos una fila de butacas")
    .refine(
      (rows) => new Set(rows.map((r) => r.rowLabel.toUpperCase())).size === rows.length,
      "No puede haber filas con la misma etiqueta",
    ),
});

export const updateRoomSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  roomType: z.nativeEnum(RoomType).optional(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
