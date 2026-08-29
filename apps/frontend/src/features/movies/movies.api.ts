import { apiClient } from "@/lib/api-client";
import type {
  Genre,
  ListMoviesParams,
  MovieDetail,
  MovieSummary,
  PaginatedResult,
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
