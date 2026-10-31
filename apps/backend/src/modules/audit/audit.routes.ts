import { Router } from "express";
import type { Request, Response } from "express";
import { authenticate } from "@/middleware/authenticate";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { catchAsync } from "@/utils/catch-async";
import { listAuditLogs, listAuditLogsQuerySchema, type ListAuditLogsQuery } from "@/modules/audit/audit.service";

export const auditRouter = Router();

/** Bitacora de acciones de gestion: solo SUPER_ADMIN. */
auditRouter.get(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  validate(listAuditLogsQuerySchema, "query"),
  catchAsync(async (req: Request, res: Response) => {
    res.status(200).json(await listAuditLogs(req.query as unknown as ListAuditLogsQuery));
  }),
);
