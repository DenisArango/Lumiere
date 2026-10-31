export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  isVerifiedPurchase: boolean;
  isApproved: boolean;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreateReviewInput {
  rating: number;
  comment?: string;
}

export interface AdminReview extends Review {
  movie: { id: string; title: string };
}

export interface ListAllReviewsParams {
  page?: number;
  pageSize?: number;
  isApproved?: boolean;
}
