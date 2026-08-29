import { Router } from "express";
import { validate } from "@/middleware/validate";
import { authenticate } from "@/middleware/authenticate";
import { authorize } from "@/middleware/authorize";
import { csrfProtection } from "@/middleware/csrf";
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

cinemaRouter.get("/", validate(listCinemasQuerySchema, "query"), catchAsync(cinemaController.list));
cinemaRouter.get("/:id", catchAsync(cinemaController.getById));

cinemaRouter.post(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  csrfProtection,
  validate(createCinemaSchema),
  catchAsync(cinemaController.create),
);

cinemaRouter.patch(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN"),
  csrfProtection,
  validate(updateCinemaSchema),
  catchAsync(cinemaController.update),
);

cinemaRouter.get("/:cinemaId/rooms", catchAsync(cinemaController.listRooms));

cinemaRouter.post(
  "/:cinemaId/rooms",
  authenticate,
  authorize(...staffRoles),
  csrfProtection,
  validate(createRoomSchema),
  catchAsync(cinemaController.createRoom),
);
