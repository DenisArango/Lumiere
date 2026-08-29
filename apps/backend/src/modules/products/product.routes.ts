import { Router } from "express";
import { validate } from "@/middleware/validate";
import { authenticate } from "@/middleware/authenticate";
import { authorize } from "@/middleware/authorize";
import { csrfProtection } from "@/middleware/csrf";
import { catchAsync } from "@/utils/catch-async";
import { createProductSchema, updateProductSchema } from "@/modules/products/product.schema";
import * as productController from "@/modules/products/product.controller";

export const productRouter = Router();

const staffRoles = ["SUPER_ADMIN", "CINEMA_MANAGER"] as const;

productRouter.get("/", catchAsync(productController.list));

productRouter.post(
  "/",
  authenticate,
  authorize(...staffRoles),
  csrfProtection,
  validate(createProductSchema),
  catchAsync(productController.create),
);

productRouter.patch(
  "/:id",
  authenticate,
  authorize(...staffRoles),
  csrfProtection,
  validate(updateProductSchema),
  catchAsync(productController.update),
);
