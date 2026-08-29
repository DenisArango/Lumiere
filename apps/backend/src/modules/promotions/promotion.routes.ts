import { Router } from "express";
import { validate } from "@/middleware/validate";
import { authenticate } from "@/middleware/authenticate";
import { authorize } from "@/middleware/authorize";
import { csrfProtection } from "@/middleware/csrf";
import { catchAsync } from "@/utils/catch-async";
import {
  createPromotionSchema,
  updatePromotionSchema,
  validatePromotionSchema,
} from "@/modules/promotions/promotion.schema";
import * as promotionController from "@/modules/promotions/promotion.controller";

export const promotionRouter = Router();

const staffRoles = ["SUPER_ADMIN", "CINEMA_MANAGER"] as const;

promotionRouter.get("/", catchAsync(promotionController.list));
promotionRouter.get("/:id", catchAsync(promotionController.getById));

promotionRouter.post(
  "/validate",
  authenticate,
  validate(validatePromotionSchema),
  catchAsync(promotionController.validate),
);

promotionRouter.post(
  "/",
  authenticate,
  authorize(...staffRoles),
  csrfProtection,
  validate(createPromotionSchema),
  catchAsync(promotionController.create),
);

promotionRouter.patch(
  "/:id",
  authenticate,
  authorize(...staffRoles),
  csrfProtection,
  validate(updatePromotionSchema),
  catchAsync(promotionController.update),
);
