import type { Cinema } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/utils/app-error";
import { paginate, toSkipTake, type PaginatedResult } from "@/utils/pagination";
import type {
  CreateCinemaInput,
  ListCinemasQuery,
  UpdateCinemaInput,
} from "@/modules/cinemas/cinema.schema";

export async function listCinemas(query: ListCinemasQuery): Promise<PaginatedResult<Cinema>> {
  const where = {
    isActive: true,
    ...(query.city ? { city: { equals: query.city, mode: "insensitive" as const } } : {}),
    ...(query.search
      ? { name: { contains: query.search, mode: "insensitive" as const } }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.cinema.findMany({ where, orderBy: { name: "asc" }, ...toSkipTake(query) }),
    prisma.cinema.count({ where }),
  ]);

  return paginate(items, total, query);
}

export async function getCinemaById(id: string) {
  const cinema = await prisma.cinema.findUnique({
    where: { id },
    include: {
      rooms: {
        select: { id: true, name: true, roomType: true, totalCapacity: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!cinema) {
    throw new NotFoundError("Cine");
  }

  return cinema;
}

export async function createCinema(input: CreateCinemaInput): Promise<Cinema> {
  return prisma.cinema.create({ data: input });
}

export async function updateCinema(id: string, input: UpdateCinemaInput): Promise<Cinema> {
  const existing = await prisma.cinema.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Cine");
  }
  return prisma.cinema.update({ where: { id }, data: input });
}
