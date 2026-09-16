import { useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { SeatMap } from "@/components/seat-map";
import { Button } from "@/components/ui/button";
import { useShowtime } from "@/features/showtimes/showtimes.hooks";
import { useLockSeats, useReleaseSeats, useSeatMap } from "@/features/bookings/bookings.hooks";
import { useAuthStore } from "@/features/auth/auth.store";
import { getApiErrorMessage } from "@/lib/api-client";
import { useEffectOnUnmount } from "@/lib/use-effect-on-unmount";
import type { SeatMapEntry } from "@/features/bookings/bookings.types";

const MAX_SEATS = 8;

export function SeatSelectionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const { data: showtime } = useShowtime(id);
  const { data: seats, isLoading } = useSeatMap(id);
  const lockMutation = useLockSeats(id ?? "");
  const releaseMutation = useReleaseSeats(id ?? "");

  const [selected, setSelected] = useState<SeatMapEntry[]>([]);
  const proceedingRef = useRef(false);

  // Si el usuario abandona esta pagina sin continuar al checkout, libera lo
  // que haya bloqueado - nadie deberia quedarse con una butaca "fantasma".
  useEffectOnUnmount(() => {
    if (!proceedingRef.current && selected.length > 0 && id) {
      void releaseMutation.mutateAsync(selected.map((s) => s.id));
    }
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-ink-muted">Inicia sesión para seleccionar tus butacas.</p>
        <Button asChild className="mt-4">
          <Link to="/iniciar-sesion" state={{ from: `/funciones/${id}/asientos` }}>
            Iniciar sesión
          </Link>
        </Button>
      </div>
    );
  }

  function toggleSeat(seat: SeatMapEntry) {
    setSelected((prev) => {
      const exists = prev.some((s) => s.id === seat.id);
      if (exists) return prev.filter((s) => s.id !== seat.id);
      if (prev.length >= MAX_SEATS) {
        toast.error(`Puedes seleccionar hasta ${MAX_SEATS} butacas por compra`);
        return prev;
      }
      return [...prev, seat];
    });
  }

  async function handleContinue() {
    if (!id || selected.length === 0) return;
    try {
      await lockMutation.mutateAsync(selected.map((s) => s.id));
      proceedingRef.current = true;
      navigate("/checkout", { state: { showtimeId: id, seatIds: selected.map((s) => s.id) } });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos reservar esas butacas, intenta con otras"));
    }
  }

  const total = showtime
    ? selected.reduce((sum, s) => sum + Number(showtime.basePrice) * Number(s.seatType.priceMultiplier), 0)
    : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="eyebrow">{showtime?.movie.title ?? "Selecciona tu función"}</p>
      <h1 className="mt-1 font-display text-2xl italic text-ink">Elige tus butacas</h1>
      {showtime && (
        <p className="mt-1 text-sm text-ink-muted">
          {showtime.room.cinema.name} · {showtime.room.name} ·{" "}
          {new Date(showtime.startTime).toLocaleString("es", { dateStyle: "long", timeStyle: "short" })}
        </p>
      )}

      <div className="mt-10 border border-hairline p-6 sm:p-10">
        {isLoading && <p className="text-center text-ink-muted">Cargando mapa de butacas…</p>}
        {seats && seats.length === 0 && (
          <p className="text-center text-ink-muted">Esta sala no tiene butacas configuradas.</p>
        )}
        {seats && seats.length > 0 && (
          <SeatMap
            seats={seats}
            myLockedIds={new Set(selected.map((s) => s.id))}
            onToggle={toggleSeat}
            disabled={lockMutation.isPending}
          />
        )}
      </div>

      <div className="sticky bottom-0 mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-hairline bg-base py-4">
        <div>
          <p className="text-sm text-ink-muted">
            {selected.length} {selected.length === 1 ? "butaca" : "butacas"} seleccionadas
          </p>
          {showtime && <p className="font-display text-xl italic text-ink">${total.toFixed(2)}</p>}
        </div>
        <Button size="lg" disabled={selected.length === 0 || lockMutation.isPending} onClick={() => void handleContinue()}>
          {lockMutation.isPending ? "Reservando…" : "Continuar al pago"}
        </Button>
      </div>
    </div>
  );
}
