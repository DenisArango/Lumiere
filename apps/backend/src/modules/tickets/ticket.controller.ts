import type { Request, Response } from "express";
import * as ticketService from "@/modules/tickets/ticket.service";
import type { ValidateTicketInput } from "@/modules/tickets/ticket.schema";

export async function validate(req: Request, res: Response): Promise<void> {
  const { qrCode } = req.body as ValidateTicketInput;
  const order = await ticketService.validateTicket(qrCode, req.user!.id);
  res.status(200).json({ order });
}
