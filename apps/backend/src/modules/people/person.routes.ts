import { Router } from "express";
import { validate } from "@/middleware/validate";
import { authenticate } from "@/middleware/authenticate";
import { authorize } from "@/middleware/authorize";
import { csrfProtection } from "@/middleware/csrf";
import { auditTrail } from "@/middleware/audit-trail";
import { catchAsync } from "@/utils/catch-async";
import {
  createPersonSchema,
  listPeopleQuerySchema,
  updatePersonSchema,
} from "@/modules/people/person.schema";
import * as personController from "@/modules/people/person.controller";

export const personRouter = Router();

const staffRoles = ["SUPER_ADMIN", "CINEMA_MANAGER"] as const;

personRouter.get("/", validate(listPeopleQuerySchema, "query"), catchAsync(personController.list));
personRouter.get("/:id", catchAsync(personController.getById));

personRouter.post(
  "/",
  authenticate,
  authorize(...staffRoles),
  csrfProtection,
  validate(createPersonSchema),
  auditTrail("person.create", "Person"),
  catchAsync(personController.create),
);

personRouter.patch(
  "/:id",
  authenticate,
  authorize(...staffRoles),
  csrfProtection,
  validate(updatePersonSchema),
  auditTrail("person.update", "Person"),
  catchAsync(personController.update),
);
