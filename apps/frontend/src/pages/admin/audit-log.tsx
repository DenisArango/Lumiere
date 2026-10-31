import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuthStore } from "@/features/auth/auth.store";
import { useAuditLogs, type AuditEntry } from "@/features/audit/audit.api";
import { formatDateTime } from "@/lib/format";

/** Verbos de la bitacora en lenguaje de persona. Lo que no este aqui se muestra tal cual. */
const ACTION_LABEL: Record<string, string> = {
  "user.create": "Creó una cuenta",
  "user.update": "Modificó una cuenta",
  "order.refund": "Reembolsó una orden",
  "order.cancel": "Canceló una orden",
  "showtime.create": "Programó una función",
  "showtime.update": "Modificó una función",
  "showtime.cancel_settlement": "Liquidó una función cancelada",
  "review.moderate": "Moderó una reseña",
  "cinema.create": "Creó un cine",
  "cinema.update": "Modificó un cine",
  "room.create": "Creó una sala",
  "room.update": "Modificó una sala",
  "movie.create": "Creó una película",
  "movie.update": "Modificó una película",
  "product.create": "Creó un producto",
  "product.update": "Modificó un producto",
  "promotion.create": "Creó una promoción",
  "promotion.update": "Modificó una promoción",
  "person.create": "Creó una persona",
  "person.update": "Modificó una persona",
  "genre.create": "Creó un género",
  "webhook.order_paid": "El proveedor de pago confirmó un pago",
  "webhook.order_refunded": "Se reembolsó desde el proveedor de pago",
  "webhook.orphan_payment_refunded": "Se reembolsó un cobro sin orden vigente",
  "webhook.amount_mismatch": "Se rechazó un pago con monto distinto",
};

const ENTITY_LABEL: Record<string, string> = {
  Order: "Órdenes",
  User: "Usuarios",
  Showtime: "Funciones",
  Cinema: "Cines",
  Room: "Salas",
  Movie: "Películas",
  Product: "Productos",
  Promotion: "Promociones",
  Review: "Reseñas",
  Person: "Personas",
  Genre: "Géneros",
};

function toneOf(action: string): BadgeTone {
  if (action.startsWith("webhook.")) return "gold";
  if (action.includes("refund") || action.includes("cancel")) return "danger";
  return "muted";
}

/** Resumen corto de los datos de la accion: solo lo que ayuda a entenderla, nunca el objeto crudo. */
function detailsOf(entry: AuditEntry): string | null {
  const m = entry.metadata;
  if (!m) return null;
  if (entry.action === "showtime.cancel_settlement") {
    const failed = Array.isArray(m.failed) ? m.failed.length : 0;
    return `${m.refunded ?? 0} reembolsadas · ${m.cancelledPending ?? 0} canceladas${failed ? ` · ${failed} con error` : ""}`;
  }
  const parts = Object.entries(m)
    .filter(([, v]) => ["string", "number", "boolean"].includes(typeof v))
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${String(v)}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Solo SUPER_ADMIN lee la bitacora; el backend lo exige tambien. */
export function AuditLogPage() {
  const role = useAuthStore((s) => s.user?.role);
  if (role && role !== "SUPER_ADMIN") return <Navigate to="/admin" replace />;
  return <AuditLogContent />;
}

function AuditLogContent() {
  const [entityType, setEntityType] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAuditLogs({
    entityType: entityType || undefined,
    action: action || undefined,
    page,
    pageSize: 20,
  });

  return (
    <div>
      <PageHeader
        eyebrow="Sistema"
        title="Auditoría"
        description="Quién hizo qué y cuándo en el panel. Las contraseñas y tokens nunca se guardan aquí."
      />

      <form
        className="mt-5 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setAction(search.trim());
          setPage(1);
        }}
      >
        <div className="w-48">
          <Select
            aria-label="Filtrar por tipo de dato"
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todo</option>
            {Object.entries(ENTITY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <Input
            aria-label="Buscar por acción"
            placeholder="Acción, ej. refund o user.create…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      {isLoading && <p className="mt-6 text-sm text-ink-muted">Cargando bitácora…</p>}

      <div className="mt-4 divide-y divide-hairline border border-hairline">
        {data?.items.map((entry) => {
          const details = detailsOf(entry);
          return (
            <div key={entry.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 p-3">
              <p className="w-40 shrink-0 text-xs text-ink-muted">{formatDateTime(entry.createdAt)}</p>
              <div className="min-w-0 flex-1 basis-64">
                <p className="text-sm text-ink">{ACTION_LABEL[entry.action] ?? entry.action}</p>
                <p className="text-xs text-ink-muted">
                  {entry.user ? `${entry.user.firstName} ${entry.user.lastName} · ${entry.user.email}` : "Sistema (proveedor de pago)"}
                  {entry.entityId ? ` · ${ENTITY_LABEL[entry.entityType] ?? entry.entityType} ${entry.entityId.slice(0, 8)}` : ""}
                </p>
                {details && <p className="mt-0.5 break-words text-xs text-ink-muted">{details}</p>}
              </div>
              <Badge tone={toneOf(entry.action)}>{entry.action}</Badge>
            </div>
          );
        })}
        {data && data.items.length === 0 && (
          <p className="p-8 text-center text-sm text-ink-muted">No hay movimientos con ese filtro.</p>
        )}
      </div>

      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}
    </div>
  );
}
