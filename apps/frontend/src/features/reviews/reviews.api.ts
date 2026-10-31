import { apiClient } from "@/lib/api-client";
import type { PaginatedResult } from "@/features/movies/movies.types";
import type {
  AdminReview,
  CreateReviewInput,
  ListAllReviewsParams,
  Review,
} from "@/features/reviews/reviews.types";

export async function fetchReviews(movieId: string): Promise<PaginatedResult<Review>> {
  const { data } = await apiClient.get<PaginatedResult<Review>>(`/movies/${movieId}/reviews`, {
    params: { pageSize: 20 },
  });
  return data;
}

export async function createReview(movieId: string, input: CreateReviewInput): Promise<Review> {
  const { data } = await apiClient.post<{ review: Review }>(`/movies/${movieId}/reviews`, input);
  return data.review;
}

export async function updateReview(reviewId: string, input: CreateReviewInput): Promise<Review> {
  const { data } = await apiClient.patch<{ review: Review }>(`/reviews/${reviewId}`, input);
  return data.review;
}

export async function deleteReview(reviewId: string): Promise<void> {
  await apiClient.delete(`/reviews/${reviewId}`);
}

export async function fetchAllReviews(params: ListAllReviewsParams): Promise<PaginatedResult<AdminReview>> {
  const { data } = await apiClient.get<PaginatedResult<AdminReview>>("/reviews", { params });
  return data;
}

export async function moderateReview(reviewId: string, isApproved: boolean): Promise<Review> {
  const { data } = await apiClient.patch<{ review: Review }>(`/reviews/${reviewId}/moderate`, { isApproved });
  return data.review;
}
