import { Router } from "express";
import { validate } from "@/middleware/validate";
import { authenticate } from "@/middleware/authenticate";
import { csrfProtection } from "@/middleware/csrf";
import { catchAsync } from "@/utils/catch-async";
import {
  createOrderSchema,
  listOrdersQuerySchema,
  lockSeatsSchema,
  releaseSeatsSchema,
} from "@/modules/bookings/booking.schema";
import * as bookingController from "@/modules/bookings/booking.controller";

/** Montado en /api/v1/showtimes junto al showtimeRouter. */
export const showtimeSeatRouter = Router();

showtimeSeatRouter.get("/:showtimeId/seats", catchAsync(bookingController.getSeatMap));

showtimeSeatRouter.post(
  "/:showtimeId/seats/lock",
  authenticate,
  csrfProtection,
  validate(lockSeatsSchema),
  catchAsync(bookingController.lockSeats),
);

showtimeSeatRouter.post(
  "/:showtimeId/seats/release",
  authenticate,
  csrfProtection,
  validate(releaseSeatsSchema),
  catchAsync(bookingController.releaseSeats),
);

/** Montado en /api/v1/orders. */
export const orderRouter = Router();

orderRouter.post(
  "/",
  authenticate,
  csrfProtection,
  validate(createOrderSchema),
  catchAsync(bookingController.createOrder),
);

orderRouter.get(
  "/me",
  authenticate,
  validate(listOrdersQuerySchema, "query"),
  catchAsync(bookingController.listMyOrders),
);

orderRouter.get("/:id", authenticate, catchAsync(bookingController.getOrderById));

orderRouter.post(
  "/:id/cancel",
  authenticate,
  csrfProtection,
  catchAsync(bookingController.cancelOrder),
);
