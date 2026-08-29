import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { catchAsync } from "@/utils/catch-async";

export const seatTypeRouter = Router();

seatTypeRouter.get(
  "/",
  catchAsync(async (_req, res) => {
    const seatTypes = await prisma.seatType.findMany({ orderBy: { priceMultiplier: "asc" } });
    res.status(200).json({ seatTypes });
  }),
);
