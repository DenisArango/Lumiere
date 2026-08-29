import type { Request, Response } from "express";
import * as showtimeService from "@/modules/showtimes/showtime.service";
import type {
  CreateShowtimeInput,
  ListShowtimesQuery,
  UpdateShowtimeInput,
} from "@/modules/showtimes/showtime.schema";

export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListShowtimesQuery;
  const result = await showtimeService.listShowtimes(query);
  res.status(200).json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const showtime = await showtimeService.getShowtimeById(req.params.id as string);
  res.status(200).json({ showtime });
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateShowtimeInput;
  const showtime = await showtimeService.createShowtime(input);
  res.status(201).json({ showtime });
}

export async function update(req: Request, res: Response): Promise<void> {
  const input = req.body as UpdateShowtimeInput;
  const showtime = await showtimeService.updateShowtime(req.params.id as string, input);
  res.status(200).json({ showtime });
}
