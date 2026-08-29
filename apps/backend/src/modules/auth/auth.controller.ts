import type { Request, Response } from "express";
import { setAuthCookies, clearAuthCookies, getRefreshTokenCookie } from "@/lib/cookies";
import { UnauthorizedError, NotFoundError } from "@/utils/app-error";
import * as authService from "@/modules/auth/auth.service";
import type { LoginInput, RegisterInput } from "@/modules/auth/auth.schema";

function contextFrom(req: Request): authService.AuthContext {
  return {
    userAgent: req.header("user-agent"),
    ipAddress: req.ip,
  };
}

export async function register(req: Request, res: Response): Promise<void> {
  const input = req.body as RegisterInput;
  const { user, tokens } = await authService.registerUser(input, contextFrom(req));
  setAuthCookies(res, tokens);
  res.status(201).json({ user });
}

export async function login(req: Request, res: Response): Promise<void> {
  const input = req.body as LoginInput;
  const { user, tokens } = await authService.loginUser(input, contextFrom(req));
  setAuthCookies(res, tokens);
  res.status(200).json({ user });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const rawRefreshToken = getRefreshTokenCookie(req.cookies ?? {});
  if (!rawRefreshToken) {
    throw new UnauthorizedError("No hay sesión activa");
  }

  const { user, tokens } = await authService.refreshSession(rawRefreshToken, contextFrom(req));
  setAuthCookies(res, tokens);
  res.status(200).json({ user });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const rawRefreshToken = getRefreshTokenCookie(req.cookies ?? {});
  if (rawRefreshToken) {
    await authService.logoutUser(rawRefreshToken);
  }
  clearAuthCookies(res);
  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  // req.user es garantizado por el middleware `authenticate` montado en la ruta.
  const user = await authService.getUserById(req.user!.id);
  if (!user) {
    throw new NotFoundError("Usuario");
  }
  res.status(200).json({ user });
}
