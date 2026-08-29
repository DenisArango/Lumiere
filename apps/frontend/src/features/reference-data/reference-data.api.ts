import { apiClient } from "@/lib/api-client";
import type { Language, MovieRating } from "@/features/movies/movies.types";

export async function fetchRatings(): Promise<MovieRating[]> {
  const { data } = await apiClient.get<{ ratings: MovieRating[] }>("/ratings");
  return data.ratings;
}

export async function fetchLanguages(): Promise<Language[]> {
  const { data } = await apiClient.get<{ languages: Language[] }>("/languages");
  return data.languages;
}
