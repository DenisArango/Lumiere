import argon2 from "argon2";
import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { ConflictError, ForbiddenError, NotFoundError } from "@/utils/app-error";
import { paginate, toSkipTake, type PaginatedResult } from "@/utils/pagination";
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from "@/modules/users/user.schema";

export type PublicUser = Omit<User, "passwordHash">;

function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

export async function listUsers(query: ListUsersQuery): Promise<PaginatedResult<PublicUser>> {
  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.search
      ? {
          OR: [
            { email: { contains: query.search, mode: "insensitive" } },
            { firstName: { contains: query.search, mode: "insensitive" } },
            { lastName: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, ...toSkipTake(query) }),
    prisma.user.count({ where }),
  ]);
  return paginate(users.map(toPublicUser), total, query);
}

export async function createUser(input: CreateUserInput): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError("Ya existe una cuenta con este email");
  }

  const { password, ...rest } = input;
  const user = await prisma.user.create({
    data: { ...rest, passwordHash: await argon2.hash(password) },
  });

  logger.info({ userId: user.id, role: user.role }, "Usuario creado por un administrador");
  return toPublicUser(user);
}

/**
 * Un administrador no puede quitarse el rol ni desactivarse a si mismo:
 * evita que el sistema se quede sin ningun SUPER_ADMIN por un clic.
 * Desactivar una cuenta revoca todas sus sesiones (refresh tokens) para
 * que no pueda renovar el acceso.
 */
export async function updateUser(actorId: string, userId: string, input: UpdateUserInput): Promise<PublicUser> {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    throw new NotFoundError("Usuario");
  }

  if (actorId === userId && (input.role !== undefined || input.isActive === false)) {
    throw new ForbiddenError("No puedes cambiar tu propio rol ni desactivar tu propia cuenta");
  }

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: userId }, data: input });
    if (input.isActive === false) {
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return updated;
  });

  logger.info({ actorId, userId }, "Usuario actualizado por un administrador");
  return toPublicUser(user);
}

export async function joinLoyaltyProgram(userId: string): Promise<PublicUser> {
  const user = await prisma.user.update({ where: { id: userId }, data: { loyaltyMember: true } });
  return toPublicUser(user);
}
