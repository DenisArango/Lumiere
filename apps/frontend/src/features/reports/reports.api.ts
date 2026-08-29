import { apiClient } from "@/lib/api-client";
import type {
  DayDemand,
  HourDemand,
  MostViewedMovie,
  PromotionEffectiveness,
  ReportQuery,
} from "@/features/reports/reports.types";

export async function fetchMostViewedMovies(params: ReportQuery): Promise<MostViewedMovie[]> {
  const { data } = await apiClient.get<{ movies: MostViewedMovie[] }>("/reports/most-viewed-movies", { params });
  return data.movies;
}

export async function fetchPeakDemand(
  params: ReportQuery,
): Promise<{ byHourOfDay: HourDemand[]; byDayOfWeek: DayDemand[] }> {
  const { data } = await apiClient.get<{ byHourOfDay: HourDemand[]; byDayOfWeek: DayDemand[] }>(
    "/reports/peak-demand",
    { params },
  );
  return data;
}

export async function fetchPromotionEffectiveness(params: ReportQuery): Promise<PromotionEffectiveness[]> {
  const { data } = await apiClient.get<{ promotions: PromotionEffectiveness[] }>(
    "/reports/promotion-effectiveness",
    { params },
  );
  return data.promotions;
}
