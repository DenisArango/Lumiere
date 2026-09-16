import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createShowtime, fetchShowtimeById, fetchShowtimes } from "@/features/showtimes/showtimes.api";
import type { CreateShowtimeInput, ListShowtimesParams } from "@/features/showtimes/showtimes.types";

export function useShowtimes(params: ListShowtimesParams) {
  return useQuery({
    queryKey: ["showtimes", params],
    queryFn: () => fetchShowtimes(params),
    enabled: Boolean(params.movieId || params.cinemaId),
  });
}

/** Para el panel de administracion: lista sin exigir movieId/cinemaId (a diferencia de useShowtimes, pensado para la pagina publica por pelicula). */
export function useShowtimesAll(params: ListShowtimesParams) {
  return useQuery({ queryKey: ["showtimes", "all", params], queryFn: () => fetchShowtimes(params) });
}

export function useShowtime(id: string | undefined) {
  return useQuery({
    queryKey: ["showtime", id],
    queryFn: () => fetchShowtimeById(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateShowtime() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateShowtimeInput) => createShowtime(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["showtimes"] }),
  });
}
