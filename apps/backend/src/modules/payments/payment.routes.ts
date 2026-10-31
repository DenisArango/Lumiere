import { Router } from "express";
import { validate } from "@/middleware/validate";
import { authenticate } from "@/middleware/authenticate";
import { csrfProtection } from "@/middleware/csrf";
import { paymentRateLimiter } from "@/middleware/rate-limit";
import { auditTrail } from "@/middleware/audit-trail";
import { catchAsync } from "@/utils/catch-async";
import { checkoutSessionSchema, confirmPaymentSchema, payOrderSchema } from "@/modules/payments/payment.schema";
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
  auditTrail("order.refund", "Order"),
  catchAsync(paymentController.refund),
);

/** Cierra un pago que quedo esperando 3D Secure (el servidor vuelve a verificarlo con el proveedor). */
paymentRouter.post(
  "/:id/pay/confirm",
  authenticate,
  paymentRateLimiter,
  csrfProtection,
  validate(confirmPaymentSchema),
  catchAsync(paymentController.confirm),
);

/** PayPal: la orden de PayPal se crea en el servidor con el total de nuestra orden. */
paymentRouter.post(
  "/:id/checkout-session",
  authenticate,
  paymentRateLimiter,
  csrfProtection,
  validate(checkoutSessionSchema),
  catchAsync(paymentController.checkoutSession),
);

/** Montado en /api/v1/payments: configuracion publica para el checkout. */
export const paymentConfigRouter = Router();
paymentConfigRouter.get("/config", paymentController.config);

