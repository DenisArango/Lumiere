import path from "node:path";
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
import { languageRouter, ratingRouter } from "@/modules/reference-data/reference-data.routes";
import { productRouter } from "@/modules/products/product.routes";
import { ticketRouter } from "@/modules/tickets/ticket.routes";
import { showtimeRouter } from "@/modules/showtimes/showtime.routes";
import { orderRouter, showtimeSeatRouter } from "@/modules/bookings/booking.routes";
import { promotionRouter } from "@/modules/promotions/promotion.routes";
import { movieReviewRouter, reviewRouter } from "@/modules/reviews/review.routes";
import { reportRouter } from "@/modules/reports/report.routes";
import { paymentConfigRouter, paymentRouter } from "@/modules/payments/payment.routes";
import { userRouter } from "@/modules/users/user.routes";
import { auditRouter } from "@/modules/audit/audit.routes";
import { webhookRouter } from "@/modules/webhooks/webhook.routes";

/**
 * Construye la app de Express sin arrancar el servidor (facilita testing
 * con supertest, que importa la app directamente). El bootstrap real
 * (listen, conexiones) vive en server.ts.
 */
export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);

  app.use(
    helmet({
      // En produccion este mismo servidor entrega el sitio, asi que la CSP debe permitir exactamente lo que el
      // checkout necesita de Stripe y PayPal (scripts, marcos de pago, 3D Secure) y nada mas.
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: [
                "'self'",
                "https://js.stripe.com",
                "https://www.paypal.com",
                "https://www.sandbox.paypal.com",
                "https://*.paypalobjects.com",
              ],
              // 'unsafe-inline' en estilos: React/motion fijan estilos en linea y el SDK de PayPal inyecta <style>.
              styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
              fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
              imgSrc: ["'self'", "data:", "blob:", "https:"],
              connectSrc: [
                "'self'",
                "https://api.stripe.com",
                "https://m.stripe.network",
                "https://r.stripe.com",
                "https://www.paypal.com",
                "https://www.sandbox.paypal.com",
                "https://*.paypal.com",
              ],
              frameSrc: [
                "'self'",
                "https://js.stripe.com",
                "https://hooks.stripe.com",
                "https://m.stripe.network",
                "https://www.paypal.com",
                "https://www.sandbox.paypal.com",
                "https://*.paypal.com",
              ],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              frameAncestors: ["'none'"],
              // Render ya sirve solo por HTTPS; ademas, esta directiva rompe probar la imagen en http://localhost.
              upgradeInsecureRequests: null,
            },
          }
        : false,
      // El boton de PayPal abre una ventana emergente que le devuelve el resultado a esta pagina; con el valor por
      // defecto (same-origin) el navegador corta esa comunicacion y el pago nunca regresa.
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    }),
  );

  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
      credentials: true,
    }),
  );

  app.use(compression());

  // Webhooks de proveedores de pago: ANTES de express.json(). La firma se verifica sobre el cuerpo sin
  // parsear; si json() lo consumiera primero, ninguna firma seria valida.
  app.use("/api/v1/webhooks", webhookRouter);

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
  app.use("/api/v1/users", userRouter);
  app.use("/api/v1/audit-logs", auditRouter);
  app.use("/api/v1/genres", genreRouter);
  app.use("/api/v1/people", personRouter);
  app.use("/api/v1/movies", movieRouter);
  app.use("/api/v1/cinemas", cinemaRouter);
  app.use("/api/v1/rooms", roomRouter);
  app.use("/api/v1/seat-types", seatTypeRouter);
  app.use("/api/v1/ratings", ratingRouter);
  app.use("/api/v1/languages", languageRouter);
  app.use("/api/v1/products", productRouter);
  app.use("/api/v1/tickets", ticketRouter);
  app.use("/api/v1/showtimes", showtimeRouter);
  app.use("/api/v1/showtimes", showtimeSeatRouter);
  app.use("/api/v1/orders", orderRouter);
  app.use("/api/v1/promotions", promotionRouter);
  app.use("/api/v1/movies", movieReviewRouter);
  app.use("/api/v1/reviews", reviewRouter);
  app.use("/api/v1/reports", reportRouter);
  app.use("/api/v1/orders", paymentRouter);
  app.use("/api/v1/payments", paymentConfigRouter);

  // Frontend compilado (un solo servicio sirve sitio + API). Cualquier ruta que no sea de la API ni de websockets
  // devuelve index.html para que react-router resuelva la URL en el navegador.
  if (env.FRONTEND_DIST) {
    const dist = path.resolve(env.FRONTEND_DIST);
    app.use(
      express.static(dist, {
        index: false,
        setHeaders: (res, filePath) => {
          // Los archivos de /assets llevan hash en el nombre: se pueden cachear para siempre.
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        },
      }),
    );
    app.get(/^\/(?!api\/|socket\.io\/).*/, (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(dist, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
