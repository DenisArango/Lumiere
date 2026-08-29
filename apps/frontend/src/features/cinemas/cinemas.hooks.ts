import { useQuery } from "@tanstack/react-query";
import { fetchCinemaById, fetchCinemas } from "@/features/cinemas/cinemas.api";

export function useCinemas() {
  return useQuery({ queryKey: ["cinemas"], queryFn: fetchCinemas, staleTime: 5 * 60 * 1000 });
}

export function useCinema(id: string | undefined) {
  return useQuery({
    queryKey: ["cinema", id],
    queryFn: () => fetchCinemaById(id as string),
    enabled: Boolean(id),
  });
}
