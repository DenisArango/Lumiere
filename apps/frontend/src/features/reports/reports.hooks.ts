import { useQuery } from "@tanstack/react-query";
import {
  fetchMostViewedMovies,
  fetchPeakDemand,
  fetchPromotionEffectiveness,
} from "@/features/reports/reports.api";
import type { ReportQuery } from "@/features/reports/reports.types";

export function useMostViewedMovies(params: ReportQuery) {
  return useQuery({ queryKey: ["reports", "most-viewed", params], queryFn: () => fetchMostViewedMovies(params) });
}

export function usePeakDemand(params: ReportQuery) {
  return useQuery({ queryKey: ["reports", "peak-demand", params], queryFn: () => fetchPeakDemand(params) });
}

export function usePromotionEffectiveness(params: ReportQuery) {
  return useQuery({
    queryKey: ["reports", "promotions", params],
    queryFn: () => fetchPromotionEffectiveness(params),
  });
}
