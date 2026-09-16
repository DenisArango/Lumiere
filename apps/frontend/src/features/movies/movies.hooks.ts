import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createMovie, fetchGenres, fetchMovieById, fetchMovies, updateMovie } from "@/features/movies/movies.api";
import type { CreateMovieInput, ListMoviesParams, UpdateMovieInput } from "@/features/movies/movies.types";

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

export function useCreateMovie() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMovieInput) => createMovie(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["movies"] }),
  });
}

export function useUpdateMovie(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMovieInput) => updateMovie(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["movies"] });
      void queryClient.invalidateQueries({ queryKey: ["movie", id] });
    },
  });
}
