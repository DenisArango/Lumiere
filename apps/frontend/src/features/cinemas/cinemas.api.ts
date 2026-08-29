import { apiClient } from "@/lib/api-client";
import type { CinemaDetail } from "@/features/cinemas/cinemas.types";
import type { PaginatedResult } from "@/features/movies/movies.types";
import type { Cinema } from "@/features/cinemas/cinemas.types";

export async function fetchCinemas(): Promise<PaginatedResult<Cinema>> {
  const { data } = await apiClient.get<PaginatedResult<Cinema>>("/cinemas", { params: { pageSize: 50 } });
  return data;
}

export async function fetchCinemaById(id: string): Promise<CinemaDetail> {
  const { data } = await apiClient.get<{ cinema: CinemaDetail }>(`/cinemas/${id}`);
  return data.cinema;
}
