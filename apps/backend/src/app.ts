import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import hpp from "hpp";
import pinoHttp from "pino-http";
import { env, isProduction } from "@/config/env";
import { logger } from "@/lib/logger";
import { globalRateLimiter } from "@/middleware/rate-limit";
import { notFoundHandler } from "@/middleware/not-found";
import { errorHandler } from "@/middleware/error-handler";
import { authRouter } from "@/modules/auth/auth.routes";
import { genreRouter } from "@/modules/genres/genre.routes";
import { personRouter } from "@/modules/people/person.routes";
import { movieRouter } from "@/modules/movies/movie.routes";
import { cinemaRouter } from "@/modules/cinemas/cinema.routes";
import { roomRouter } from "@/modules/cinemas/room.routes";
import { seatTypeRouter } from "@/modules/seat-types/seat-type.routes";
import { showtimeRouter } from "@/modules/showtimes/showtime.routes";
import { orderRouter, showtimeSeatRouter } from "@/modules/bookings/booking.routes";

/**
 * Construye la app de Express sin arrancar el servidor (facilita testing
 * con supertest, que importa la app directamente). El bootstrap real
 * (listen, conexiones) vive en server.ts.
 */
export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'"],
              imgSrc: ["'self'", "data:", "https:"],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
    }),
  );

  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
      credentials: true,
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(cookieParser());
  app.use(hpp());

  app.use(
    pinoHttp({
      logger,
      redact: ["req.headers.authorization", "req.headers.cookie"],
      autoLogging: {
        ignore: (req) => req.url === "/api/v1/health",
      },
    }),
  );

  app.use("/api/v1", globalRateLimiter);

  app.get("/api/v1/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "lumiere-api", timestamp: new Date().toISOString() });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/genres", genreRouter);
  app.use("/api/v1/people", personRouter);
  app.use("/api/v1/movies", movieRouter);
  app.use("/api/v1/cinemas", cinemaRouter);
  app.use("/api/v1/rooms", roomRouter);
  app.use("/api/v1/seat-types", seatTypeRouter);
  app.use("/api/v1/showtimes", showtimeRouter);
  app.use("/api/v1/showtimes", showtimeSeatRouter);
  app.use("/api/v1/orders", orderRouter);

  // El resto de routers de dominio (payments, promotions, reviews, reports)
  // se montan aqui a medida que cada modulo se construye (ver PROJECT.md
  // seccion 6).

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
