export type DiscountType = "PERCENTAGE" | "FIXED";

export interface PromotionRule {
  id?: string;
  movieId?: string;
  cinemaId?: string;
  dayOfWeek?: number;
}

export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  code: string;
  discountType: DiscountType;
  discountValue: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  rules: PromotionRule[];
}

export interface CreatePromotionInput {
  name: string;
  description?: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  rules: PromotionRule[];
}
