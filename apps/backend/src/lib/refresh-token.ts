import { randomBytes, createHash } from "node:crypto";
import ms from "@/utils/ms";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";

/**
 * Refresh token opaco (no JWT): 48 bytes aleatorios, se entrega en texto
 * plano al cliente (cookie httpOnly) y solo su hash SHA-256 se persiste.
 * Esto permite revocar tokens individuales (logout, rotacion, compromiso
 * detectado) sin necesitar una lista negra de JWTs.
 */
export function generateRefreshTokenValue(): string {
  return randomBytes(48).toString("hex");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

interface IssueRefreshTokenParams {
  userId: string;
  userAgent?: string;
  ipAddress?: string;
}

export async function issueRefreshToken(params: IssueRefreshTokenParams): Promise<string> {
  const token = generateRefreshTokenValue();
  const expiresAt = new Date(Date.now() + ms(env.JWT_REFRESH_EXPIRES_IN));

  await prisma.refreshToken.create({
    data: {
      userId: params.userId,
      tokenHash: hashRefreshToken(token),
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
      expiresAt,
    },
  });

  return token;
}

/**
 * Revoca (marca revokedAt) el refresh token dado. Usado tanto en logout
 * explicito como en rotacion (el token anterior se revoca al emitir uno
 * nuevo, para que no pueda reutilizarse aunque no haya expirado).
 */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
