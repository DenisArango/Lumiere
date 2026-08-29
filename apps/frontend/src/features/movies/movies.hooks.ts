import { useQuery } from "@tanstack/react-query";
import { fetchGenres, fetchMovieById, fetchMovies } from "@/features/movies/movies.api";
import type { ListMoviesParams } from "@/features/movies/movies.types";

export function useMovies(params: ListMoviesParams) {
  return useQuery({
    queryKey: ["movies", params],
    queryFn: () => fetchMovies(params),
    placeholderData: (previous) => previous,
  });
}

export function useMovie(id: string | undefined) {
  return useQuery({
    queryKey: ["movie", id],
    queryFn: () => fetchMovieById(id as string),
    enabled: Boolean(id),
  });
}

export function useGenres() {
  return useQuery({ queryKey: ["genres"], queryFn: fetchGenres, staleTime: 10 * 60 * 1000 });
}
