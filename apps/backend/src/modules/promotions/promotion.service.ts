import { DiscountType, type Promotion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/utils/app-error";
import type { CreatePromotionInput, UpdatePromotionInput } from "@/modules/promotions/promotion.schema";

export async function listActivePromotions() {
  const now = new Date();
  return prisma.promotion.findMany({
    where: { isActive: true, startDate: { lte: now }, endDate: { gte: now } },
    include: { rules: true },
    orderBy: { startDate: "desc" },
  });
}

export async function getPromotionById(id: string) {
  const promotion = await prisma.promotion.findUnique({ where: { id }, include: { rules: true } });
  if (!promotion) {
    throw new NotFoundError("Promoción");
  }
  return promotion;
}

export async function createPromotion(input: CreatePromotionInput): Promise<Promotion> {
  const existing = await prisma.promotion.findUnique({ where: { code: input.code } });
  if (existing) {
    throw new ConflictError("Ya existe una promoción con ese código");
  }

  const { rules, ...promotionData } = input;
  return prisma.promotion.create({
    data: { ...promotionData, rules: { create: rules } },
  });
}

export async function updatePromotion(id: string, input: UpdatePromotionInput): Promise<Promotion> {
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Promoción");
  }

  const { rules, ...promotionData } = input;

  return prisma.$transaction(async (tx) => {
    if (rules) {
      await tx.promotionRule.deleteMany({ where: { promotionId: id } });
      if (rules.length > 0) {
        await tx.promotionRule.createMany({ data: rules.map((r) => ({ ...r, promotionId: id })) });
      }
    }
    return tx.promotion.update({ where: { id }, data: promotionData });
  });
}

export function calculateDiscount(promotion: Promotion, subtotal: number): number {
  if (promotion.discountType === DiscountType.PERCENTAGE) {
    return Math.round(subtotal * (Number(promotion.discountValue) / 100) * 100) / 100;
  }
  return Math.min(Number(promotion.discountValue), subtotal);
}

/**
 * Un codigo aplica a una funcion si al menos una de sus reglas coincide
 * (pelicula, cine o dia de la semana), o si la promocion no tiene reglas
 * (promocion global). dayOfWeek se compara en UTC por consistencia con el
 * resto del proyecto (ver docs/backend/04-funciones.md sobre filtros de
 * fecha) - documentado como simplificacion a revisar cuando el frontend
 * defina la zona horaria de exhibicion al usuario final.
 */
export async function getApplicablePromotion(code: string, showtimeId: string) {
  const now = new Date();

  const promotion = await prisma.promotion.findUnique({
    where: { code: code.toUpperCase() },
    include: { rules: true },
  });

  if (!promotion || !promotion.isActive || promotion.startDate > now || promotion.endDate < now) {
    throw new NotFoundError("Código de promoción válido");
  }

  const showtime = await prisma.showtime.findUnique({
    where: { id: showtimeId },
    include: { room: { select: { cinemaId: true } } },
  });
  if (!showtime) {
    throw new NotFoundError("Función");
  }

  const applies =
    promotion.rules.length === 0 ||
    promotion.rules.some(
      (rule) =>
        (rule.movieId && rule.movieId === showtime.movieId) ||
        (rule.cinemaId && rule.cinemaId === showtime.room.cinemaId) ||
        (rule.dayOfWeek !== null && rule.dayOfWeek === showtime.startTime.getUTCDay()),
    );

  if (!applies) {
    throw new ConflictError("Este código no aplica para la función seleccionada");
  }

  return promotion;
}
