import { Router } from "express";
import { validate } from "@/middleware/validate";
import { authenticate } from "@/middleware/authenticate";
import { authorize } from "@/middleware/authorize";
import { csrfProtection } from "@/middleware/csrf";
import { requireStaffForInactive } from "@/middleware/include-inactive";
import { auditTrail } from "@/middleware/audit-trail";
import { catchAsync } from "@/utils/catch-async";
import {
  createCinemaSchema,
  listCinemasQuerySchema,
  updateCinemaSchema,
} from "@/modules/cinemas/cinema.schema";
import { createRoomSchema } from "@/modules/cinemas/room.schema";
import * as cinemaController from "@/modules/cinemas/cinema.controller";

export const cinemaRouter = Router();

const staffRoles = ["SUPER_ADMIN", "CINEMA_MANAGER"] as const;

cinemaRouter.get(
  "/",
  requireStaffForInactive,
  validate(listCinemasQuerySchema, "query"),
  catchAsync(cinemaController.list),
);
cinemaRouter.get("/:id", catchAsync(cinemaController.getById));

cinemaRouter.post(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  csrfProtection,
  validate(createCinemaSchema),
  auditTrail("cinema.create", "Cinema"),
  catchAsync(cinemaController.create),
);

cinemaRouter.patch(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN"),
  csrfProtection,
  validate(updateCinemaSchema),
  auditTrail("cinema.update", "Cinema"),
  catchAsync(cinemaController.update),
);

cinemaRouter.get("/:cinemaId/rooms", catchAsync(cinemaController.listRooms));

cinemaRouter.post(
  "/:cinemaId/rooms",
  authenticate,
  authorize(...staffRoles),
  csrfProtection,
  validate(createRoomSchema),
  auditTrail("room.create", "Room"),
  catchAsync(cinemaController.createRoom),
);
