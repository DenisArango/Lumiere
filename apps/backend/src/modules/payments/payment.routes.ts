import { Router } from "express";
import { validate } from "@/middleware/validate";
import { authenticate } from "@/middleware/authenticate";
import { csrfProtection } from "@/middleware/csrf";
import { paymentRateLimiter } from "@/middleware/rate-limit";
import { catchAsync } from "@/utils/catch-async";
import { payOrderSchema } from "@/modules/payments/payment.schema";
import * as paymentController from "@/modules/payments/payment.controller";

/** Montado en /api/v1/orders, junto al orderRouter del modulo de reservas. */
export const paymentRouter = Router();

paymentRouter.post(
  "/:id/pay",
  authenticate,
  paymentRateLimiter,
  csrfProtection,
  validate(payOrderSchema),
  catchAsync(paymentController.pay),
);

paymentRouter.post(
  "/:id/refund",
  authenticate,
  paymentRateLimiter,
  csrfProtection,
  catchAsync(paymentController.refund),
);
