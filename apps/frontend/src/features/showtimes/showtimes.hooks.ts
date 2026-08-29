import { useQuery } from "@tanstack/react-query";
import { fetchShowtimeById, fetchShowtimes } from "@/features/showtimes/showtimes.api";
import type { ListShowtimesParams } from "@/features/showtimes/showtimes.types";

export function useShowtimes(params: ListShowtimesParams) {
  return useQuery({
    queryKey: ["showtimes", params],
    queryFn: () => fetchShowtimes(params),
    enabled: Boolean(params.movieId || params.cinemaId),
  });
}

export function useShowtime(id: string | undefined) {
  return useQuery({
    queryKey: ["showtime", id],
    queryFn: () => fetchShowtimeById(id as string),
    enabled: Boolean(id),
  });
}
