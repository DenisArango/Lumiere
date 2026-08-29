import type { Request, Response } from "express";
import * as paymentService from "@/modules/payments/payment.service";
import type { PayOrderInput } from "@/modules/payments/payment.schema";

const STAFF_ROLES = new Set(["SUPER_ADMIN", "CINEMA_MANAGER"]);

export async function pay(req: Request, res: Response): Promise<void> {
  const { provider, source } = req.body as PayOrderInput;
  const order = await paymentService.payOrder(req.params.id as string, req.user!.id, provider, source);
  res.status(200).json({ order });
}

export async function refund(req: Request, res: Response): Promise<void> {
  const isStaff = STAFF_ROLES.has(req.user!.role);
  const order = await paymentService.refundOrder(req.params.id as string, req.user!.id, isStaff);
  res.status(200).json({ order });
}
