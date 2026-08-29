import type { Response } from "express";
import { env, isProduction } from "@/config/env";
import ms from "@/utils/ms";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";
export const CSRF_COOKIE = "csrf_token";

const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  domain: env.COOKIE_DOMAIN,
  path: "/",
};

/**
 * access_token y refresh_token viajan httpOnly (inaccesibles a JS, mitiga
 * robo por XSS). csrf_token es deliberadamente NO httpOnly: el frontend
 * debe poder leerlo para reenviarlo como header X-CSRF-Token (patron
 * double-submit cookie) - ver middleware/csrf.ts y docs/06-seguridad.md.
 */
export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string; csrfToken: string },
): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseCookieOptions,
    maxAge: ms(env.JWT_ACCESS_EXPIRES_IN),
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseCookieOptions,
    maxAge: ms(env.JWT_REFRESH_EXPIRES_IN),
  });
  res.cookie(CSRF_COOKIE, tokens.csrfToken, {
    ...baseCookieOptions,
    httpOnly: false,
    maxAge: ms(env.JWT_REFRESH_EXPIRES_IN),
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, baseCookieOptions);
  res.clearCookie(REFRESH_COOKIE, baseCookieOptions);
  res.clearCookie(CSRF_COOKIE, { ...baseCookieOptions, httpOnly: false });
}

export function getAccessTokenCookie(cookies: Record<string, string>): string | undefined {
  return cookies[ACCESS_COOKIE];
}

export function getRefreshTokenCookie(cookies: Record<string, string>): string | undefined {
  return cookies[REFRESH_COOKIE];
}
