import type { Request, Response } from "express";
import * as promotionService from "@/modules/promotions/promotion.service";
import type {
  CreatePromotionInput,
  UpdatePromotionInput,
  ValidatePromotionInput,
} from "@/modules/promotions/promotion.schema";

export async function list(_req: Request, res: Response): Promise<void> {
  const promotions = await promotionService.listActivePromotions();
  res.status(200).json({ promotions });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const promotion = await promotionService.getPromotionById(req.params.id as string);
  res.status(200).json({ promotion });
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreatePromotionInput;
  const promotion = await promotionService.createPromotion(input);
  res.status(201).json({ promotion });
}

export async function update(req: Request, res: Response): Promise<void> {
  const input = req.body as UpdatePromotionInput;
  const promotion = await promotionService.updatePromotion(req.params.id as string, input);
  res.status(200).json({ promotion });
}

export async function validate(req: Request, res: Response): Promise<void> {
  const { code, showtimeId } = req.body as ValidatePromotionInput;
  // No se calcula un monto de descuento aqui: el subtotal real depende de
  // las butacas/combos que el cliente aun no ha elegido. Este endpoint solo
  // confirma si el codigo es valido y aplica a la funcion, y devuelve el
  // tipo/valor del descuento para que el frontend muestre una vista previa.
  const promotion = await promotionService.getApplicablePromotion(code, showtimeId);
  res.status(200).json({ promotion });
}
