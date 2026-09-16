import { useQuery } from "@tanstack/react-query";
import { fetchLanguages, fetchRatings, fetchSeatTypes } from "@/features/reference-data/reference-data.api";

export function useRatings() {
  return useQuery({ queryKey: ["ratings"], queryFn: fetchRatings, staleTime: 30 * 60 * 1000 });
}

export function useLanguages() {
  return useQuery({ queryKey: ["languages"], queryFn: fetchLanguages, staleTime: 30 * 60 * 1000 });
}

export function useSeatTypes() {
  return useQuery({ queryKey: ["seat-types"], queryFn: fetchSeatTypes, staleTime: 30 * 60 * 1000 });
}
