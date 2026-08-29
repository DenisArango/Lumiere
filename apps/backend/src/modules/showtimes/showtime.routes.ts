import { Router } from "express";
import { validate } from "@/middleware/validate";
import { authenticate } from "@/middleware/authenticate";
import { authorize } from "@/middleware/authorize";
import { csrfProtection } from "@/middleware/csrf";
import { catchAsync } from "@/utils/catch-async";
import {
  createShowtimeSchema,
  listShowtimesQuerySchema,
  updateShowtimeSchema,
} from "@/modules/showtimes/showtime.schema";
import * as showtimeController from "@/modules/showtimes/showtime.controller";

export const showtimeRouter = Router();

const staffRoles = ["SUPER_ADMIN", "CINEMA_MANAGER"] as const;

showtimeRouter.get(
  "/",
  validate(listShowtimesQuerySchema, "query"),
  catchAsync(showtimeController.list),
);
showtimeRouter.get("/:id", catchAsync(showtimeController.getById));

showtimeRouter.post(
  "/",
  authenticate,
  authorize(...staffRoles),
  csrfProtection,
  validate(createShowtimeSchema),
  catchAsync(showtimeController.create),
);

showtimeRouter.patch(
  "/:id",
  authenticate,
  authorize(...staffRoles),
  csrfProtection,
  validate(updateShowtimeSchema),
  catchAsync(showtimeController.update),
);
