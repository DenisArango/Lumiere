import argon2 from "argon2";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { signAccessToken } from "@/lib/jwt";
import { generateCsrfToken } from "@/lib/csrf";
import {
  hashRefreshToken,
  issueRefreshToken,
  revokeRefreshToken,
} from "@/lib/refresh-token";
import { ConflictError, UnauthorizedError } from "@/utils/app-error";
import { logger } from "@/lib/logger";
import type { LoginInput, RegisterInput } from "@/modules/auth/auth.schema";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

export interface AuthContext {
  userAgent?: string;
  ipAddress?: string;
}

export type PublicUser = Omit<User, "passwordHash">;

function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

async function issueTokensFor(user: User, ctx: AuthContext): Promise<AuthTokens> {
  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await issueRefreshToken({
    userId: user.id,
    userAgent: ctx.userAgent,
    ipAddress: ctx.ipAddress,
  });
  return { accessToken, refreshToken, csrfToken: generateCsrfToken() };
}

export async function registerUser(
  input: RegisterInput,
  ctx: AuthContext,
): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError("Ya existe una cuenta con este email");
  }

  const passwordHash = await argon2.hash(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
    },
  });

  logger.info({ userId: user.id }, "Usuario registrado");

  const tokens = await issueTokensFor(user, ctx);
  return { user: toPublicUser(user), tokens };
}

export async function loginUser(
  input: LoginInput,
  ctx: AuthContext,
): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Mismo mensaje de error tanto si el usuario no existe como si la
  // contraseña es incorrecta - evita que un atacante pueda enumerar
  // cuentas registradas probando emails.
  const invalidCredentialsError = new UnauthorizedError("Email o contraseña incorrectos");

  if (!user || !user.isActive) {
    throw invalidCredentialsError;
  }

  const passwordValid = await argon2.verify(user.passwordHash, input.password);
  if (!passwordValid) {
    throw invalidCredentialsError;
  }

  logger.info({ userId: user.id }, "Login exitoso");

  const tokens = await issueTokensFor(user, ctx);
  return { user: toPublicUser(user), tokens };
}

export async function refreshSession(
  rawRefreshToken: string,
  ctx: AuthContext,
): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  const tokenHash = hashRefreshToken(rawRefreshToken);

  const existingToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  const invalidTokenError = new UnauthorizedError("Sesión inválida, inicia sesión de nuevo");

  if (
    !existingToken ||
    existingToken.revokedAt !== null ||
    existingToken.expiresAt < new Date() ||
    !existingToken.user.isActive
  ) {
    throw invalidTokenError;
  }

  // Rotacion: se revoca el token usado (no puede reutilizarse) y se emite
  // uno nuevo - ver docs/05-diagramas-uml.md seccion 4.
  await revokeRefreshToken(rawRefreshToken);

  const tokens = await issueTokensFor(existingToken.user, ctx);
  return { user: toPublicUser(existingToken.user), tokens };
}

export async function logoutUser(rawRefreshToken: string): Promise<void> {
  await revokeRefreshToken(rawRefreshToken);
}

export async function getUserById(userId: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user ? toPublicUser(user) : null;
}
