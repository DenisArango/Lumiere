import type { Review } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, ForbiddenError, NotFoundError } from "@/utils/app-error";
import { paginate, toSkipTake, type Pagination, type PaginatedResult } from "@/utils/pagination";
import type { CreateReviewInput, UpdateReviewInput } from "@/modules/reviews/review.schema";

const authorSelect = { id: true, firstName: true, lastName: true } as const;

/**
 * Una reseña queda "verificada" si el usuario tiene al menos una orden
 * PAID de una funcion de esa pelicula - se calcula al crear, nunca se
 * confia en un flag enviado por el cliente (ver RF-06 / valor agregado en
 * docs/01-requerimientos.md).
 */
async function hasVerifiedPurchase(userId: string, movieId: string): Promise<boolean> {
  const paidOrder = await prisma.order.findFirst({
    where: { userId, status: "PAID", showtime: { movieId } },
    select: { id: true },
  });
  return paidOrder !== null;
}

export async function listReviewsByMovie(
  movieId: string,
  query: Pagination,
): Promise<PaginatedResult<unknown>> {
  const where = { movieId, isApproved: true };
  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: { user: { select: authorSelect } },
      orderBy: { createdAt: "desc" },
      ...toSkipTake(query),
    }),
    prisma.review.count({ where }),
  ]);
  return paginate(items, total, query);
}

export async function createReview(
  userId: string,
  movieId: string,
  input: CreateReviewInput,
): Promise<Review> {
  const movie = await prisma.movie.findUnique({ where: { id: movieId } });
  if (!movie) {
    throw new NotFoundError("Película");
  }

  const existing = await prisma.review.findUnique({ where: { userId_movieId: { userId, movieId } } });
  if (existing) {
    throw new ConflictError("Ya tienes una reseña para esta película — edítala en vez de crear otra");
  }

  const isVerifiedPurchase = await hasVerifiedPurchase(userId, movieId);

  return prisma.review.create({
    data: { userId, movieId, rating: input.rating, comment: input.comment, isVerifiedPurchase },
  });
}

export async function updateReview(
  reviewId: string,
  userId: string,
  input: UpdateReviewInput,
): Promise<Review> {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) {
    throw new NotFoundError("Reseña");
  }
  if (review.userId !== userId) {
    throw new ForbiddenError();
  }
  return prisma.review.update({ where: { id: reviewId }, data: input });
}

export async function moderateReview(reviewId: string, isApproved: boolean): Promise<Review> {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) {
    throw new NotFoundError("Reseña");
  }
  return prisma.review.update({ where: { id: reviewId }, data: { isApproved } });
}

export async function deleteReview(reviewId: string, userId: string, isStaff: boolean): Promise<void> {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) {
    throw new NotFoundError("Reseña");
  }
  if (review.userId !== userId && !isStaff) {
    throw new ForbiddenError();
  }
  await prisma.review.delete({ where: { id: reviewId } });
}

export async function getMovieRatingSummary(movieId: string) {
  const result = await prisma.review.aggregate({
    where: { movieId, isApproved: true },
    _avg: { rating: true },
    _count: { rating: true },
  });
  return {
    averageRating: result._avg.rating ? Math.round(result._avg.rating * 10) / 10 : null,
    reviewCount: result._count.rating,
  };
}
