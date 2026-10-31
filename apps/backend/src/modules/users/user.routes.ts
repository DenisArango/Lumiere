import { Router } from "express";
import { authenticate } from "@/middleware/authenticate";
import { authorize } from "@/middleware/authorize";
import { csrfProtection } from "@/middleware/csrf";
import { validate } from "@/middleware/validate";
import { auditTrail } from "@/middleware/audit-trail";
import { catchAsync } from "@/utils/catch-async";
import { createUserSchema, listUsersQuerySchema, updateUserSchema } from "@/modules/users/user.schema";
import * as userController from "@/modules/users/user.controller";

export const userRouter = Router();

// /me/loyalty antes de /:id para que "me" no se interprete como un id.
userRouter.post("/me/loyalty", authenticate, csrfProtection, catchAsync(userController.joinLoyalty));

userRouter.get(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  validate(listUsersQuerySchema, "query"),
  catchAsync(userController.list),
);

userRouter.post(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  csrfProtection,
  validate(createUserSchema),
  auditTrail("user.create", "User"),
  catchAsync(userController.create),
);

userRouter.patch(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN"),
  csrfProtection,
  validate(updateUserSchema),
  auditTrail("user.update", "User"),
  catchAsync(userController.update),
);
