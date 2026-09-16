import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createReview, deleteReview, fetchReviews, updateReview } from "@/features/reviews/reviews.api";
import type { CreateReviewInput } from "@/features/reviews/reviews.types";

export function useReviews(movieId: string | undefined) {
  return useQuery({
    queryKey: ["reviews", movieId],
    queryFn: () => fetchReviews(movieId as string),
    enabled: Boolean(movieId),
  });
}

export function useCreateReview(movieId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReviewInput) => createReview(movieId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reviews", movieId] });
      void queryClient.invalidateQueries({ queryKey: ["movie", movieId] });
    },
  });
}

export function useUpdateReview(movieId: string, reviewId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReviewInput) => updateReview(reviewId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reviews", movieId] });
      void queryClient.invalidateQueries({ queryKey: ["movie", movieId] });
    },
  });
}

export function useDeleteReview(movieId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => deleteReview(reviewId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reviews", movieId] });
      void queryClient.invalidateQueries({ queryKey: ["movie", movieId] });
    },
  });
}
