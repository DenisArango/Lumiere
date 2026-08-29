import { prisma } from "@/lib/prisma";
import type { ReportQuery } from "@/modules/reports/report.schema";

const DEFAULT_WINDOW_DAYS = 90;

function resolveRange(query: ReportQuery): { from: Date; to: Date } {
  const to = query.to ?? new Date();
  const from = query.from ?? new Date(to.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return { from, to };
}

interface MostViewedRow {
  movieId: string;
  title: string;
  ticketsSold: number;
}

/**
 * "Peliculas mas vistas" (RF-08) se mide por boletos vendidos (OrderSeat de
 * ordenes PAID), no por vistas de pagina - es la metrica de negocio real
 * que el enunciado pide, ver docs/backend/08-reportes.md.
 */
export async function mostViewedMovies(query: ReportQuery): Promise<MostViewedRow[]> {
  const { from, to } = resolveRange(query);

  return prisma.$queryRaw<MostViewedRow[]>`
    SELECT m.id as "movieId", m.title, COUNT(os.id)::int as "ticketsSold"
    FROM order_seats os
    JOIN orders o ON o.id = os."orderId"
    JOIN showtimes s ON s.id = o."showtimeId"
    JOIN movies m ON m.id = s."movieId"
    WHERE o.status = 'PAID' AND o."createdAt" BETWEEN ${from} AND ${to}
    GROUP BY m.id, m.title
    ORDER BY "ticketsSold" DESC
    LIMIT ${query.limit}
  `;
}

interface HourDemandRow {
  hourOfDay: number;
  ticketsSold: number;
}

interface DayDemandRow {
  dayOfWeek: number;
  ticketsSold: number;
}

/**
 * "Horarios de mayor demanda" desglosado en dos vistas complementarias:
 * por hora del dia (0-23) y por dia de la semana (0=domingo, UTC - mismo
 * criterio que el resto del proyecto, ver docs/backend/04-funciones.md).
 */
export async function peakDemand(
  query: ReportQuery,
): Promise<{ byHourOfDay: HourDemandRow[]; byDayOfWeek: DayDemandRow[] }> {
  const { from, to } = resolveRange(query);

  const byHourOfDay = await prisma.$queryRaw<HourDemandRow[]>`
    SELECT EXTRACT(HOUR FROM s."startTime")::int as "hourOfDay", COUNT(os.id)::int as "ticketsSold"
    FROM order_seats os
    JOIN orders o ON o.id = os."orderId"
    JOIN showtimes s ON s.id = o."showtimeId"
    WHERE o.status = 'PAID' AND o."createdAt" BETWEEN ${from} AND ${to}
    GROUP BY "hourOfDay"
    ORDER BY "ticketsSold" DESC
  `;

  const byDayOfWeek = await prisma.$queryRaw<DayDemandRow[]>`
    SELECT EXTRACT(DOW FROM s."startTime")::int as "dayOfWeek", COUNT(os.id)::int as "ticketsSold"
    FROM order_seats os
    JOIN orders o ON o.id = os."orderId"
    JOIN showtimes s ON s.id = o."showtimeId"
    WHERE o.status = 'PAID' AND o."createdAt" BETWEEN ${from} AND ${to}
    GROUP BY "dayOfWeek"
    ORDER BY "ticketsSold" DESC
  `;

  return { byHourOfDay, byDayOfWeek };
}

interface PromotionEffectivenessRow {
  promotionId: string;
  name: string;
  code: string;
  timesUsed: number;
  totalDiscountGranted: number;
  totalRevenue: number;
}

/**
 * El filtro de fecha va en la condicion del LEFT JOIN, no en un WHERE
 * posterior - asi las promociones sin ningun uso en el rango siguen
 * apareciendo con timesUsed=0 en vez de desaparecer del reporte.
 */
export async function promotionEffectiveness(query: ReportQuery): Promise<PromotionEffectivenessRow[]> {
  const { from, to } = resolveRange(query);

  return prisma.$queryRaw<PromotionEffectivenessRow[]>`
    SELECT
      p.id as "promotionId",
      p.name,
      p.code,
      COUNT(o.id)::int as "timesUsed",
      COALESCE(SUM(o."discountAmount"), 0)::float8 as "totalDiscountGranted",
      COALESCE(SUM(o."totalAmount"), 0)::float8 as "totalRevenue"
    FROM promotions p
    LEFT JOIN orders o
      ON o."promotionId" = p.id AND o.status = 'PAID' AND o."createdAt" BETWEEN ${from} AND ${to}
    GROUP BY p.id, p.name, p.code
    ORDER BY "timesUsed" DESC
    LIMIT ${query.limit}
  `;
}
