import type { Request, Response } from "express";
import * as productService from "@/modules/products/product.service";
import type { CreateProductInput, UpdateProductInput } from "@/modules/products/product.schema";

export async function list(_req: Request, res: Response): Promise<void> {
  const products = await productService.listActiveProducts();
  res.status(200).json({ products });
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateProductInput;
  const product = await productService.createProduct(input);
  res.status(201).json({ product });
}

export async function update(req: Request, res: Response): Promise<void> {
  const input = req.body as UpdateProductInput;
  const product = await productService.updateProduct(req.params.id as string, input);
  res.status(200).json({ product });
}
