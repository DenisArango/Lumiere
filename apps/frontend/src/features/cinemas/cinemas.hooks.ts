import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCinema,
  createRoom,
  fetchCinemaById,
  fetchCinemas,
  fetchRoomsByCinema,
} from "@/features/cinemas/cinemas.api";
import type { CreateCinemaInput, CreateRoomInput } from "@/features/cinemas/cinemas.types";

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

export function useCreateCinema() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCinemaInput) => createCinema(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["cinemas"] }),
  });
}

export function useRoomsByCinema(cinemaId: string | undefined) {
  return useQuery({
    queryKey: ["rooms", cinemaId],
    queryFn: () => fetchRoomsByCinema(cinemaId as string),
    enabled: Boolean(cinemaId),
  });
}

export function useCreateRoom(cinemaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoomInput) => createRoom(cinemaId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["cinema", cinemaId] }),
  });
}
