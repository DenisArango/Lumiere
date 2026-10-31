import { Router } from "express";
import { validate } from "@/middleware/validate";
import { authenticate } from "@/middleware/authenticate";
import { authorize } from "@/middleware/authorize";
import { csrfProtection } from "@/middleware/csrf";
import { auditTrail } from "@/middleware/audit-trail";
import { catchAsync } from "@/utils/catch-async";
import {
  createReviewSchema,
  listAllReviewsQuerySchema,
  listReviewsQuerySchema,
  moderateReviewSchema,
  updateReviewSchema,
} from "@/modules/reviews/review.schema";
import * as reviewController from "@/modules/reviews/review.controller";

/** Montado en /api/v1/movies (anidado bajo :movieId). */
export const movieReviewRouter = Router();

movieReviewRouter.get(
  "/:movieId/reviews",
  validate(listReviewsQuerySchema, "query"),
  catchAsync(reviewController.listByMovie),
);

movieReviewRouter.post(
  "/:movieId/reviews",
  authenticate,
  csrfProtection,
  validate(createReviewSchema),
  catchAsync(reviewController.create),
);

/** Montado en /api/v1/reviews. */
export const reviewRouter = Router();

reviewRouter.get(
  "/",
  authenticate,
  authorize("SUPER_ADMIN", "CINEMA_MANAGER"),
  validate(listAllReviewsQuerySchema, "query"),
  catchAsync(reviewController.listAll),
);

reviewRouter.patch(
  "/:id",
  authenticate,
  csrfProtection,
  validate(updateReviewSchema),
  catchAsync(reviewController.update),
);

reviewRouter.patch(
  "/:id/moderate",
  authenticate,
  authorize("SUPER_ADMIN", "CINEMA_MANAGER"),
  csrfProtection,
  validate(moderateReviewSchema),
  auditTrail("review.moderate", "Review"),
  catchAsync(reviewController.moderate),
);

reviewRouter.delete("/:id", authenticate, csrfProtection, catchAsync(reviewController.remove));
