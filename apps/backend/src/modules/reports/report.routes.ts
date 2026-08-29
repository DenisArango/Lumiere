import { Router } from "express";
import { validate } from "@/middleware/validate";
import { authenticate } from "@/middleware/authenticate";
import { authorize } from "@/middleware/authorize";
import { catchAsync } from "@/utils/catch-async";
import { reportQuerySchema } from "@/modules/reports/report.schema";
import * as reportController from "@/modules/reports/report.controller";

export const reportRouter = Router();

const staffRoles = ["SUPER_ADMIN", "CINEMA_MANAGER"] as const;

// Reporteria es inteligencia de negocio, nunca publica - todas las rutas
// requieren rol de staff.
reportRouter.use(authenticate, authorize(...staffRoles), validate(reportQuerySchema, "query"));

reportRouter.get("/most-viewed-movies", catchAsync(reportController.mostViewedMovies));
reportRouter.get("/peak-demand", catchAsync(reportController.peakDemand));
reportRouter.get("/promotion-effectiveness", catchAsync(reportController.promotionEffectiveness));
