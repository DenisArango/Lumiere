import type { Request, Response } from "express";
import * as genreService from "@/modules/genres/genre.service";
import type { CreateGenreInput } from "@/modules/genres/genre.schema";

export async function list(_req: Request, res: Response): Promise<void> {
  const genres = await genreService.listGenres();
  res.status(200).json({ genres });
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateGenreInput;
  const genre = await genreService.createGenre(input);
  res.status(201).json({ genre });
}
