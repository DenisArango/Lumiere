import { Router } from "express";
import { validate as validateBody } from "@/middleware/validate";
import { authenticate } from "@/middleware/authenticate";
import { authorize } from "@/middleware/authorize";
import { csrfProtection } from "@/middleware/csrf";
import { catchAsync } from "@/utils/catch-async";
import { validateTicketSchema } from "@/modules/tickets/ticket.schema";
import * as ticketController from "@/modules/tickets/ticket.controller";

export const ticketRouter = Router();

ticketRouter.post(
  "/validate",
  authenticate,
  authorize("BOX_OFFICE", "CINEMA_MANAGER", "SUPER_ADMIN"),
  csrfProtection,
  validateBody(validateTicketSchema),
  catchAsync(ticketController.validate),
);
