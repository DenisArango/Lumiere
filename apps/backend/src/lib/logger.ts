import pino from "pino";
import { isProduction } from "@/config/env";

/**
 * Logger estructurado. Nunca debe recibir contraseñas, tokens ni datos de
 * pago crudos - ver docs/06-seguridad.md seccion "Capa backend".
 */
export const logger = pino({
  level: isProduction ? "info" : "debug",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
      "*.cardNumber",
    ],
    censor: "[REDACTED]",
  },
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
      },
});
