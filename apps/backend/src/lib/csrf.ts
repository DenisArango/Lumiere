import { randomBytes } from "node:crypto";

export function generateCsrfToken(): string {
  return randomBytes(24).toString("hex");
}
