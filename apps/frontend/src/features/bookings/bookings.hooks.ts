import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMyOrders, fetchSeatMap, lockSeats, releaseSeats } from "@/features/bookings/bookings.api";
import { joinShowtimeRoom, getSocket } from "@/lib/socket";

function seatMapKey(showtimeId: string) {
  return ["seat-map", showtimeId] as const;
}

/**
 * Trae el mapa de butacas y se suscribe al room de Socket.io de esta
 * funcion: cualquier seat:locked/seat:released/seat:sold emitido por el
 * backend (ver docs/backend/05-reservas.md) invalida la query y refresca
 * el mapa para TODOS los clientes viendo esta funcion, no solo quien
 * hizo la accion.
 */
export function useSeatMap(showtimeId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!showtimeId) return;
    const leave = joinShowtimeRoom(showtimeId);
    const socket = getSocket();

    const invalidate = () => void queryClient.invalidateQueries({ queryKey: seatMapKey(showtimeId) });
    socket.on("seat:locked", invalidate);
    socket.on("seat:released", invalidate);
    socket.on("seat:sold", invalidate);

    return () => {
      socket.off("seat:locked", invalidate);
      socket.off("seat:released", invalidate);
      socket.off("seat:sold", invalidate);
      leave();
    };
  }, [showtimeId, queryClient]);

  return useQuery({
    queryKey: seatMapKey(showtimeId ?? ""),
    queryFn: () => fetchSeatMap(showtimeId as string),
    enabled: Boolean(showtimeId),
    refetchInterval: 15_000,
  });
}

export function useLockSeats(showtimeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (seatIds: string[]) => lockSeats(showtimeId, seatIds),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: seatMapKey(showtimeId) }),
  });
}

export function useReleaseSeats(showtimeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (seatIds: string[]) => releaseSeats(showtimeId, seatIds),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: seatMapKey(showtimeId) }),
  });
}

export function useMyOrders() {
  return useQuery({ queryKey: ["my-orders"], queryFn: fetchMyOrders });
}
