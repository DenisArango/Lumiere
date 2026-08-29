import { apiClient } from "@/lib/api-client";
import type { PaginatedResult } from "@/features/movies/movies.types";
import type {
  Cinema,
  CinemaDetail,
  CreateCinemaInput,
  CreateRoomInput,
  Room,
} from "@/features/cinemas/cinemas.types";

export async function fetchCinemas(): Promise<PaginatedResult<Cinema>> {
  const { data } = await apiClient.get<PaginatedResult<Cinema>>("/cinemas", { params: { pageSize: 50 } });
  return data;
}

export async function fetchCinemaById(id: string): Promise<CinemaDetail> {
  const { data } = await apiClient.get<{ cinema: CinemaDetail }>(`/cinemas/${id}`);
  return data.cinema;
}

export async function createCinema(input: CreateCinemaInput): Promise<Cinema> {
  const { data } = await apiClient.post<{ cinema: Cinema }>("/cinemas", input);
  return data.cinema;
}

export async function createRoom(cinemaId: string, input: CreateRoomInput): Promise<Room> {
  const { data } = await apiClient.post<{ room: Room }>(`/cinemas/${cinemaId}/rooms`, input);
  return data.room;
}

export async function fetchRoomsByCinema(cinemaId: string): Promise<Room[]> {
  const { data } = await apiClient.get<{ rooms: Room[] }>(`/cinemas/${cinemaId}/rooms`);
  return data.rooms;
}
