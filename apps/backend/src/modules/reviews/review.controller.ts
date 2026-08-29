import type { Request, Response } from "express";
import * as reviewService from "@/modules/reviews/review.service";
import type {
  CreateReviewInput,
  ModerateReviewInput,
  UpdateReviewInput,
} from "@/modules/reviews/review.schema";
import type { Pagination } from "@/utils/pagination";

const STAFF_ROLES = new Set(["SUPER_ADMIN", "CINEMA_MANAGER"]);

export async function listByMovie(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as Pagination;
  const result = await reviewService.listReviewsByMovie(req.params.movieId as string, query);
  res.status(200).json(result);
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateReviewInput;
  const review = await reviewService.createReview(req.user!.id, req.params.movieId as string, input);
  res.status(201).json({ review });
}

export async function update(req: Request, res: Response): Promise<void> {
  const input = req.body as UpdateReviewInput;
  const review = await reviewService.updateReview(req.params.id as string, req.user!.id, input);
  res.status(200).json({ review });
}

export async function moderate(req: Request, res: Response): Promise<void> {
  const { isApproved } = req.body as ModerateReviewInput;
  const review = await reviewService.moderateReview(req.params.id as string, isApproved);
  res.status(200).json({ review });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const isStaff = STAFF_ROLES.has(req.user!.role);
  await reviewService.deleteReview(req.params.id as string, req.user!.id, isStaff);
  res.status(204).send();
}
