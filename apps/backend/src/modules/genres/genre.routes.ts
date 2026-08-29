import { Router } from "express";
import { validate } from "@/middleware/validate";
import { authenticate } from "@/middleware/authenticate";
import { authorize } from "@/middleware/authorize";
import { csrfProtection } from "@/middleware/csrf";
import { catchAsync } from "@/utils/catch-async";
import { createGenreSchema } from "@/modules/genres/genre.schema";
import * as genreController from "@/modules/genres/genre.controller";

export const genreRouter = Router();

genreRouter.get("/", catchAsync(genreController.list));

genreRouter.post(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  csrfProtection,
  validate(createGenreSchema),
  catchAsync(genreController.create),
);
