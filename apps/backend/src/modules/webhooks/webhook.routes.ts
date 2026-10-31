import express, { Router } from "express";
import type { Request, Response } from "express";
import { catchAsync } from "@/utils/catch-async";
import { constructStripeEvent, handleStripeEvent } from "@/modules/webhooks/stripe-webhook.service";
import { constructPayPalEvent, handlePayPalEvent } from "@/modules/webhooks/paypal-webhook.service";

/**
 * Montado en /api/v1/webhooks ANTES de express.json(): la firma se calcula sobre los bytes exactos del cuerpo,
 * asi que aqui se recibe SIN parsear (Buffer). No hay cookies ni CSRF: la autenticidad la da la firma del proveedor.
 */
export const webhookRouter = Router();

const rawJson = express.raw({ type: "application/json", limit: "1mb" });

webhookRouter.post(
  "/stripe",
  rawJson,
  catchAsync(async (req: Request, res: Response) => {
    const event = constructStripeEvent(req.body as Buffer, req.header("stripe-signature"));
    const outcome = await handleStripeEvent(event);
    res.status(200).json({ received: true, outcome });
  }),
);

webhookRouter.post(
  "/paypal",
  rawJson,
  catchAsync(async (req: Request, res: Response) => {
    const headers = {
      "paypal-auth-algo": req.header("paypal-auth-algo"),
      "paypal-cert-url": req.header("paypal-cert-url"),
      "paypal-transmission-id": req.header("paypal-transmission-id"),
      "paypal-transmission-sig": req.header("paypal-transmission-sig"),
      "paypal-transmission-time": req.header("paypal-transmission-time"),
    };
    const event = await constructPayPalEvent(req.body as Buffer, headers);
    const outcome = await handlePayPalEvent(event);
    res.status(200).json({ received: true, outcome });
  }),
);
