import type { Request, Response } from "express";
import * as cinemaService from "@/modules/cinemas/cinema.service";
import * as roomService from "@/modules/cinemas/room.service";
import type {
  CreateCinemaInput,
  ListCinemasQuery,
  UpdateCinemaInput,
} from "@/modules/cinemas/cinema.schema";
import type { CreateRoomInput } from "@/modules/cinemas/room.schema";

export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListCinemasQuery;
  const result = await cinemaService.listCinemas(query);
  res.status(200).json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const cinema = await cinemaService.getCinemaById(req.params.id as string);
  res.status(200).json({ cinema });
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateCinemaInput;
  const cinema = await cinemaService.createCinema(input);
  res.status(201).json({ cinema });
}

export async function update(req: Request, res: Response): Promise<void> {
  const input = req.body as UpdateCinemaInput;
  const cinema = await cinemaService.updateCinema(req.params.id as string, input);
  res.status(200).json({ cinema });
}

export async function listRooms(req: Request, res: Response): Promise<void> {
  const rooms = await roomService.listRoomsByCinema(req.params.cinemaId as string);
  res.status(200).json({ rooms });
}

export async function createRoom(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateRoomInput;
  const room = await roomService.createRoom(req.params.cinemaId as string, input);
  res.status(201).json({ room });
}
