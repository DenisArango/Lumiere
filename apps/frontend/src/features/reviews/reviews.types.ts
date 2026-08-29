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
