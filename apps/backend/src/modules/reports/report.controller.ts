import type { Request, Response } from "express";
import * as reportService from "@/modules/reports/report.service";
import type { ReportQuery } from "@/modules/reports/report.schema";

export async function mostViewedMovies(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ReportQuery;
  const movies = await reportService.mostViewedMovies(query);
  res.status(200).json({ movies });
}

export async function peakDemand(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ReportQuery;
  const result = await reportService.peakDemand(query);
  res.status(200).json(result);
}

export async function promotionEffectiveness(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ReportQuery;
  const promotions = await reportService.promotionEffectiveness(query);
  res.status(200).json({ promotions });
}
