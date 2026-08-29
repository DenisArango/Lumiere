import { apiClient } from "@/lib/api-client";
import type {
  CreateMovieInput,
  Genre,
  ListMoviesParams,
  MovieDetail,
  MovieSummary,
  PaginatedResult,
  UpdateMovieInput,
} from "@/features/movies/movies.types";

export async function fetchMovies(params: ListMoviesParams): Promise<PaginatedResult<MovieSummary>> {
  const { data } = await apiClient.get<PaginatedResult<MovieSummary>>("/movies", { params });
  return data;
}

export async function fetchMovieById(id: string): Promise<MovieDetail> {
  const { data } = await apiClient.get<{ movie: MovieDetail }>(`/movies/${id}`);
  return data.movie;
}

export async function fetchGenres(): Promise<Genre[]> {
  const { data } = await apiClient.get<{ genres: Genre[] }>("/genres");
  return data.genres;
}

export async function createMovie(input: CreateMovieInput): Promise<MovieDetail> {
  const { data } = await apiClient.post<{ movie: MovieDetail }>("/movies", input);
  return data.movie;
}

export async function updateMovie(id: string, input: UpdateMovieInput): Promise<MovieDetail> {
  const { data } = await apiClient.patch<{ movie: MovieDetail }>(`/movies/${id}`, input);
  return data.movie;
}
