import type { Product } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/utils/app-error";
import type { CreateProductInput, UpdateProductInput } from "@/modules/products/product.schema";

/**
 * Combos de dulceria (RF-07 valor agregado, ver docs/01-requerimientos.md
 * seccion "Valor agregado") - vinculados a una orden via OrderItem, ya
 * soportado por el modulo de reservas desde su construccion; lo que
 * faltaba era exponer la gestion del catalogo de productos en si.
 */
export async function listActiveProducts(): Promise<Product[]> {
  return prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  return prisma.product.create({ data: input });
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Producto");
  }
  return prisma.product.update({ where: { id }, data: input });
}
