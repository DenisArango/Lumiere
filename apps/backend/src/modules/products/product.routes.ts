import { Router } from "express";
import { validate } from "@/middleware/validate";
import { authenticate } from "@/middleware/authenticate";
import { authorize } from "@/middleware/authorize";
import { requireStaffForInactive } from "@/middleware/include-inactive";
import { csrfProtection } from "@/middleware/csrf";
import { auditTrail } from "@/middleware/audit-trail";
import { catchAsync } from "@/utils/catch-async";
import { createProductSchema, updateProductSchema } from "@/modules/products/product.schema";
import * as productController from "@/modules/products/product.controller";

export const productRouter = Router();

const staffRoles = ["SUPER_ADMIN", "CINEMA_MANAGER"] as const;

productRouter.get("/", requireStaffForInactive, catchAsync(productController.list));

productRouter.post(
  "/",
  authenticate,
  authorize(...staffRoles),
  csrfProtection,
  validate(createProductSchema),
  auditTrail("product.create", "Product"),
  catchAsync(productController.create),
);

productRouter.patch(
  "/:id",
  authenticate,
  authorize(...staffRoles),
  csrfProtection,
  validate(updateProductSchema),
  auditTrail("product.update", "Product"),
  catchAsync(productController.update),
);
