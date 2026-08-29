import type { Genre } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError } from "@/utils/app-error";
import type { CreateGenreInput } from "@/modules/genres/genre.schema";

export async function listGenres(): Promise<Genre[]> {
  return prisma.genre.findMany({ orderBy: { name: "asc" } });
}

export async function createGenre(input: CreateGenreInput): Promise<Genre> {
  const existing = await prisma.genre.findUnique({ where: { name: input.name } });
  if (existing) {
    throw new ConflictError("Ya existe un género con ese nombre");
  }
  return prisma.genre.create({ data: input });
}
