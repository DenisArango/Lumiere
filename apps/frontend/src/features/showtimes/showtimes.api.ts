import { apiClient } from "@/lib/api-client";
import type { PaginatedResult } from "@/features/movies/movies.types";
import type { ListShowtimesParams, Showtime } from "@/features/showtimes/showtimes.types";

export async function fetchShowtimes(params: ListShowtimesParams): Promise<PaginatedResult<Showtime>> {
  const { data } = await apiClient.get<PaginatedResult<Showtime>>("/showtimes", { params });
  return data;
}
