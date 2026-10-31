import { Router } from "express";
import { validate } from "@/middleware/validate";
import { authenticate } from "@/middleware/authenticate";
import { authorize } from "@/middleware/authorize";
import { csrfProtection } from "@/middleware/csrf";
import { auditTrail } from "@/middleware/audit-trail";
import { catchAsync } from "@/utils/catch-async";
import { updateRoomSchema } from "@/modules/cinemas/room.schema";
import * as roomController from "@/modules/cinemas/room.controller";

export const roomRouter = Router();

roomRouter.get("/:id", catchAsync(roomController.getById));

roomRouter.patch(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN", "CINEMA_MANAGER"),
  csrfProtection,
  validate(updateRoomSchema),
  auditTrail("room.update", "Room"),
  catchAsync(roomController.update),
);
