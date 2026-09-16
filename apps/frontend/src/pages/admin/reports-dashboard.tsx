import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMostViewedMovies, usePeakDemand, usePromotionEffectiveness } from "@/features/reports/reports.hooks";

const GOLD = "var(--lumiere-accent-gold)";
const GRID = "var(--lumiere-border)";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function ChartTooltip({ active, payload, label, suffix }: { active?: boolean; payload?: { value: number }[]; label?: string; suffix: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-hairline bg-elevated px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-ink">{label}</p>
      <p className="text-ink-muted">
        {payload[0]?.value} {suffix}
      </p>
    </div>
  );
}

function SectionCard({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="border border-hairline p-5">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-1 font-display text-lg italic text-ink">{title}</h2>
      <div className="mt-5">{children}</div>
    </div>
  );
}

export function ReportsDashboardPage() {
  const { data: mostViewed, isLoading: loadingViewed } = useMostViewedMovies({ limit: 8 });
  const { data: demand, isLoading: loadingDemand } = usePeakDemand({});
  const { data: promotions, isLoading: loadingPromos } = usePromotionEffectiveness({ limit: 10 });

  const hourData = (demand?.byHourOfDay ?? [])
    .slice()
    .sort((a, b) => a.hourOfDay - b.hourOfDay)
    .map((d) => ({ label: `${d.hourOfDay}:00`, ticketsSold: d.ticketsSold }));

  const dayData = (demand?.byDayOfWeek ?? [])
    .slice()
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .map((d) => ({ label: DAY_LABELS[d.dayOfWeek], ticketsSold: d.ticketsSold }));

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Indicadores</p>
        <h1 className="mt-1 font-display text-2xl italic text-ink">Reportería</h1>
        <p className="mt-1 text-sm text-ink-muted">Últimos 90 días, calculado sobre órdenes pagadas.</p>
      </div>

      <SectionCard eyebrow="RF-08" title="Películas más vistas">
        {loadingViewed && <p className="text-sm text-ink-muted">Cargando…</p>}
        {mostViewed && mostViewed.length === 0 && (
          <p className="text-sm text-ink-muted">Sin boletos vendidos todavía en este rango.</p>
        )}
        {mostViewed && mostViewed.length > 0 && (
          <ResponsiveContainer width="100%" height={Math.max(180, mostViewed.length * 40)}>
            <BarChart data={mostViewed} layout="vertical" margin={{ left: 8, right: 24 }} barCategoryGap={10}>
              <CartesianGrid horizontal={false} stroke={GRID} strokeOpacity={0.5} />
              <XAxis type="number" tick={{ fill: "var(--lumiere-text-secondary)", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="title"
                width={140}
                tick={{ fill: "var(--lumiere-text-secondary)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip suffix="boletos" />} cursor={{ fill: "var(--lumiere-border)", opacity: 0.3 }} />
              <Bar dataKey="ticketsSold" fill={GOLD} radius={[0, 4, 4, 0]} maxBarSize={22}>
                {mostViewed.map((m) => (
                  <Cell key={m.movieId} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      <div className="grid gap-6 md:grid-cols-2">
        <SectionCard eyebrow="RF-08" title="Demanda por hora">
          {loadingDemand && <p className="text-sm text-ink-muted">Cargando…</p>}
          {hourData.length > 0 && (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourData} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke={GRID} strokeOpacity={0.5} />
                <XAxis dataKey="label" tick={{ fill: "var(--lumiere-text-secondary)", fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fill: "var(--lumiere-text-secondary)", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip suffix="boletos" />} cursor={{ fill: "var(--lumiere-border)", opacity: 0.3 }} />
                <Bar dataKey="ticketsSold" fill={GOLD} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard eyebrow="RF-08" title="Demanda por día">
          {loadingDemand && <p className="text-sm text-ink-muted">Cargando…</p>}
          {dayData.length > 0 && (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dayData} barCategoryGap={8}>
                <CartesianGrid vertical={false} stroke={GRID} strokeOpacity={0.5} />
                <XAxis dataKey="label" tick={{ fill: "var(--lumiere-text-secondary)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--lumiere-text-secondary)", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip suffix="boletos" />} cursor={{ fill: "var(--lumiere-border)", opacity: 0.3 }} />
                <Bar dataKey="ticketsSold" fill={GOLD} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      <SectionCard eyebrow="RF-08 / RF-05" title="Efectividad de promociones">
        {loadingPromos && <p className="text-sm text-ink-muted">Cargando…</p>}
        {promotions && promotions.length === 0 && <p className="text-sm text-ink-muted">No hay promociones registradas.</p>}
        {promotions && promotions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-hairline text-xs uppercase tracking-wider text-ink-muted">
                  <th className="py-2 font-medium">Promoción</th>
                  <th className="py-2 font-medium">Código</th>
                  <th className="py-2 text-right font-medium">Usos</th>
                  <th className="py-2 text-right font-medium">Descuento otorgado</th>
                  <th className="py-2 text-right font-medium">Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((p) => (
                  <tr key={p.promotionId} className="border-b border-hairline last:border-0">
                    <td className="py-2.5 text-ink">{p.name}</td>
                    <td className="py-2.5 text-ink-muted">{p.code}</td>
                    <td className="py-2.5 text-right text-ink">{p.timesUsed}</td>
                    <td className="py-2.5 text-right text-ink">${p.totalDiscountGranted.toFixed(2)}</td>
                    <td className="py-2.5 text-right text-ink">${p.totalRevenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
