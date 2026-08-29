import type { Request, Response } from "express";
import * as movieService from "@/modules/movies/movie.service";
import type {
  CreateMovieInput,
  ListMoviesQuery,
  UpdateMovieInput,
} from "@/modules/movies/movie.schema";

export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListMoviesQuery;
  const result = await movieService.listMovies(query);
  res.status(200).json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const movie = await movieService.getMovieById(req.params.id as string);
  res.status(200).json({ movie });
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateMovieInput;
  const movie = await movieService.createMovie(input);
  res.status(201).json({ movie });
}

export async function update(req: Request, res: Response): Promise<void> {
  const input = req.body as UpdateMovieInput;
  const movie = await movieService.updateMovie(req.params.id as string, input);
  res.status(200).json({ movie });
}
