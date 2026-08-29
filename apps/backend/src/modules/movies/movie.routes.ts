import { Router } from "express";
import { validate } from "@/middleware/validate";
import { authenticate } from "@/middleware/authenticate";
import { authorize } from "@/middleware/authorize";
import { csrfProtection } from "@/middleware/csrf";
import { catchAsync } from "@/utils/catch-async";
import {
  createMovieSchema,
  listMoviesQuerySchema,
  updateMovieSchema,
} from "@/modules/movies/movie.schema";
import * as movieController from "@/modules/movies/movie.controller";

export const movieRouter = Router();

const staffRoles = ["SUPER_ADMIN", "CINEMA_MANAGER"] as const;

movieRouter.get("/", validate(listMoviesQuerySchema, "query"), catchAsync(movieController.list));
movieRouter.get("/:id", catchAsync(movieController.getById));

movieRouter.post(
  "/",
  authenticate,
  authorize(...staffRoles),
  csrfProtection,
  validate(createMovieSchema),
  catchAsync(movieController.create),
);

movieRouter.patch(
  "/:id",
  authenticate,
  authorize(...staffRoles),
  csrfProtection,
  validate(updateMovieSchema),
  catchAsync(movieController.update),
);
