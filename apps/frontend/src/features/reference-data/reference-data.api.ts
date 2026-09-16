import { apiClient } from "@/lib/api-client";
import type { Language, MovieRating } from "@/features/movies/movies.types";
import type { SeatType } from "@/features/bookings/bookings.types";

export async function fetchRatings(): Promise<MovieRating[]> {
  const { data } = await apiClient.get<{ ratings: MovieRating[] }>("/ratings");
  return data.ratings;
}

export async function fetchLanguages(): Promise<Language[]> {
  const { data } = await apiClient.get<{ languages: Language[] }>("/languages");
  return data.languages;
}

export async function fetchSeatTypes(): Promise<SeatType[]> {
  const { data } = await apiClient.get<{ seatTypes: SeatType[] }>("/seat-types");
  return data.seatTypes;
}
