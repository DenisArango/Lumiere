import { Router } from "express";
import { validate } from "@/middleware/validate";
import { authenticate } from "@/middleware/authenticate";
import { csrfProtection } from "@/middleware/csrf";
import { authRateLimiter } from "@/middleware/rate-limit";
import { catchAsync } from "@/utils/catch-async";
import { registerSchema, loginSchema } from "@/modules/auth/auth.schema";
import * as authController from "@/modules/auth/auth.controller";

export const authRouter = Router();

authRouter.post(
  "/register",
  authRateLimiter,
  validate(registerSchema),
  catchAsync(authController.register),
);

authRouter.post(
  "/login",
  authRateLimiter,
  validate(loginSchema),
  catchAsync(authController.login),
);

// refresh y logout operan sobre una sesion ya existente (cookies) -> CSRF aplica.
authRouter.post("/refresh", csrfProtection, catchAsync(authController.refresh));
authRouter.post("/logout", csrfProtection, catchAsync(authController.logout));

authRouter.get("/me", authenticate, catchAsync(authController.me));
