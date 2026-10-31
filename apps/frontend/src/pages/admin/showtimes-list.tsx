import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Ban, CalendarClock, Check, Pencil, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { useShowtimesAll, useUpdateShowtime } from "@/features/showtimes/showtimes.hooks";
import type { Showtime } from "@/features/showtimes/showtimes.types";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";

export function ShowtimesListPage() {
  const { data, isLoading } = useShowtimesAll({ pageSize: 50 });
  const updateMutation = useUpdateShowtime();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [toCancel, setToCancel] = useState<Showtime | null>(null);

  function startEdit(showtime: Showtime) {
    setEditingId(showtime.id);
    setPrice(String(Number(showtime.basePrice)));
  }

  async function savePrice(showtime: Showtime) {
    const value = Number(price);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Escribe un precio mayor a 0");
      return;
    }
    try {
      await updateMutation.mutateAsync({ id: showtime.id, input: { basePrice: value } });
      toast.success("Precio actualizado");
      setEditingId(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos actualizar el precio"));
    }
  }

  async function confirmCancel() {
    if (!toCancel) return;
    try {
      const { cancellation } = await updateMutation.mutateAsync({ id: toCancel.id, input: { status: "CANCELLED" } });
      setToCancel(null);
      if (cancellation && cancellation.failed.length > 0) {
        toast.error(
          `Función cancelada, pero ${cancellation.failed.length} reembolso(s) fallaron y siguen pagados. Resuélvelos desde Órdenes. (${cancellation.refunded} reembolsada(s), ${cancellation.cancelledPending} pendiente(s) cancelada(s).)`,
          { duration: 12000 },
        );
      } else if (cancellation) {
        toast.success(
          `Función cancelada: ${cancellation.refunded} orden(es) reembolsada(s) y ${cancellation.cancelledPending} pendiente(s) cancelada(s).`,
        );
      } else {
        toast.success("Función cancelada");
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos cancelar la función"));
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Programación"
        title="Funciones"
        description="Próximas funciones programadas. Cambiar el precio no afecta las órdenes ya creadas."
        action={
          <Button asChild size="sm">
            <Link to="/admin/funciones/nueva">
              <Plus className="size-4" /> Nueva
            </Link>
          </Button>
        }
      />

      {isLoading && <p className="mt-6 text-sm text-ink-muted">Cargando funciones…</p>}

      <div className="mt-5 divide-y divide-hairline border border-hairline">
        {data?.items.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-4 p-3">
            <CalendarClock className="size-4 shrink-0 text-ink-muted" />
            <div className="min-w-0 flex-1 basis-56">
              <p className="truncate font-display italic text-ink">{s.movie.title}</p>
              <p className="text-xs text-ink-muted">
                {s.room.cinema.name} · {s.room.name} · {formatDateTime(s.startTime)}
              </p>
            </div>
            <Badge>{s.availableSeats} disponibles</Badge>

            {editingId === s.id ? (
              <form
                className="flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void savePrice(s);
                }}
              >
                <Input
                  aria-label="Nuevo precio base"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="h-8 w-24"
                  autoFocus
                />
                <Button type="submit" size="sm" disabled={updateMutation.isPending} aria-label="Guardar precio">
                  <Check className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingId(null)}
                  aria-label="Cancelar edición"
                >
                  <X className="size-3.5" />
                </Button>
              </form>
            ) : (
              <>
                <p className="w-20 text-right font-display italic text-ink">{formatMoney(s.basePrice)}</p>
                <Button variant="outline" size="sm" onClick={() => startEdit(s)}>
                  <Pencil className="size-3.5" /> Precio
                </Button>
                <Button variant="outline" size="sm" onClick={() => setToCancel(s)}>
                  <Ban className="size-3.5" /> Cancelar
                </Button>
              </>
            )}
          </div>
        ))}
        {data && data.items.length === 0 && (
          <p className="p-8 text-center text-sm text-ink-muted">No hay funciones programadas.</p>
        )}
      </div>

      <ConfirmDialog
        open={toCancel !== null}
        onOpenChange={(open) => !open && setToCancel(null)}
        title="¿Cancelar esta función?"
        description={
          toCancel
            ? `“${toCancel.movie.title}” del ${formatDateTime(toCancel.startTime)} dejará de mostrarse al público y el horario quedará libre. Las órdenes ya pagadas se reembolsarán automáticamente a sus compradores y las pendientes se cancelarán.`
            : ""
        }
        confirmLabel="Sí, cancelar función"
        destructive
        isPending={updateMutation.isPending}
        onConfirm={() => void confirmCancel()}
      />
    </div>
  );
}
