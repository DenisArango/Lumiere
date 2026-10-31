import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCinema,
  createRoom,
  fetchCinemaById,
  fetchCinemas,
  fetchCinemasAdmin,
  fetchRoomsByCinema,
  updateCinema,
  updateRoom,
} from "@/features/cinemas/cinemas.api";
import type {
  CreateCinemaInput,
  CreateRoomInput,
  UpdateCinemaInput,
  UpdateRoomInput,
} from "@/features/cinemas/cinemas.types";

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

export function useCinemasAdmin() {
  return useQuery({ queryKey: ["cinemas", "admin"], queryFn: fetchCinemasAdmin });
}

export function useUpdateCinema(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCinemaInput) => updateCinema(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cinemas"] });
      void queryClient.invalidateQueries({ queryKey: ["cinema", id] });
    },
  });
}

export function useUpdateRoom(cinemaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, input }: { roomId: string; input: UpdateRoomInput }) => updateRoom(roomId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["cinema", cinemaId] }),
  });
}
