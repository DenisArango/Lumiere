import { useQuery } from "@tanstack/react-query";
import { fetchShowtimes } from "@/features/showtimes/showtimes.api";
import type { ListShowtimesParams } from "@/features/showtimes/showtimes.types";

export function useShowtimes(params: ListShowtimesParams) {
  return useQuery({
    queryKey: ["showtimes", params],
    queryFn: () => fetchShowtimes(params),
    enabled: Boolean(params.movieId || params.cinemaId),
  });
}
