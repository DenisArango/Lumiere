import type { Request, Response } from "express";
import * as roomService from "@/modules/cinemas/room.service";
import type { UpdateRoomInput } from "@/modules/cinemas/room.schema";

export async function getById(req: Request, res: Response): Promise<void> {
  const room = await roomService.getRoomById(req.params.id as string);
  res.status(200).json({ room });
}

export async function update(req: Request, res: Response): Promise<void> {
  const input = req.body as UpdateRoomInput;
  const room = await roomService.updateRoom(req.params.id as string, input);
  res.status(200).json({ room });
}
