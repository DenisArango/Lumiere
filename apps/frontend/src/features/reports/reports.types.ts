export interface MostViewedMovie {
  movieId: string;
  title: string;
  ticketsSold: number;
}

export interface HourDemand {
  hourOfDay: number;
  ticketsSold: number;
}

export interface DayDemand {
  dayOfWeek: number;
  ticketsSold: number;
}

export interface PromotionEffectiveness {
  promotionId: string;
  name: string;
  code: string;
  timesUsed: number;
  totalDiscountGranted: number;
  totalRevenue: number;
}

export interface ReportQuery {
  from?: string;
  to?: string;
  limit?: number;
}
