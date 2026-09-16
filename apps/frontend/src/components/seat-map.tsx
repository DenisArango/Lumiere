import { Fragment } from "react";
import { Accessibility } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SeatMapEntry } from "@/features/bookings/bookings.types";

export type SeatVisualStatus = "available" | "mine" | "taken";

interface SeatMapProps {
  seats: SeatMapEntry[];
  myLockedIds: Set<string>;
  onToggle: (seat: SeatMapEntry) => void;
  disabled?: boolean;
}

function visualStatus(seat: SeatMapEntry, myLockedIds: Set<string>): SeatVisualStatus {
  if (myLockedIds.has(seat.id)) return "mine";
  if (seat.status === "AVAILABLE") return "available";
  return "taken";
}

function groupByRow(seats: SeatMapEntry[]): Map<string, SeatMapEntry[]> {
  const rows = new Map<string, SeatMapEntry[]>();
  for (const seat of seats) {
    rows.set(seat.rowLabel, [...(rows.get(seat.rowLabel) ?? []), seat]);
  }
  return new Map([...rows.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Mapa de butacas como un plano de sala real, no una grilla generica de
 * casillas grises: pantalla en curva arriba, filas con pasillo cada 5
 * butacas, forma de butaca (no cuadrados planos) - ver memoria sobre
 * composicion editorial vs generica.
 */
export function SeatMap({ seats, myLockedIds, onToggle, disabled }: SeatMapProps) {
  const rows = groupByRow(seats);

  return (
    <div className="select-none">
      <div className="mx-auto mb-10 max-w-md">
        <div
          className="h-2 w-full rounded-[100%_100%_0_0/100%_100%_0_0]"
          style={{
            background: "linear-gradient(180deg, color-mix(in srgb, var(--lumiere-accent-gold) 70%, transparent), transparent)",
            boxShadow: "0 8px 30px -4px var(--lumiere-accent-gold)",
          }}
          aria-hidden
        />
        <p className="eyebrow mt-2 text-center">Pantalla</p>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        {[...rows.entries()].map(([rowLabel, rowSeats]) => (
          <div key={rowLabel} className="flex items-center gap-2">
            <span className="reel-index w-4 text-right text-xs text-ink-muted">{rowLabel}</span>
            <div className="flex gap-1.5">
              {rowSeats.map((seat, i) => {
                const status = visualStatus(seat, myLockedIds);
                const isWheelchair = seat.seatType.name.toLowerCase().includes("silla");
                const isVip = seat.seatType.name.toLowerCase().includes("vip");
                return (
                  <Fragment key={seat.id}>
                    {i > 0 && i % 5 === 0 && <span className="w-3" aria-hidden />}
                    <button
                      type="button"
                      disabled={disabled || status === "taken"}
                      onClick={() => onToggle(seat)}
                      title={`Fila ${seat.rowLabel}, butaca ${seat.seatNumber} · ${seat.seatType.name}`}
                      className={cn(
                        "flex size-6 items-center justify-center rounded-t-[3px] rounded-b-sm border text-[9px] font-medium transition-colors sm:size-7",
                        status === "available" && "border-hairline bg-transparent text-ink-muted hover:border-gold hover:text-gold",
                        status === "mine" && "border-gold bg-gold text-black",
                        status === "taken" && "cursor-not-allowed border-transparent bg-hairline/40 text-transparent",
                        isVip && status !== "mine" && "border-gold/50",
                      )}
                    >
                      {isWheelchair ? <Accessibility className="size-3" /> : seat.seatNumber}
                    </button>
                  </Fragment>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-t-[2px] border border-hairline" /> Disponible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-t-[2px] border border-gold bg-gold" /> Tu selección
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-t-[2px] bg-hairline/40" /> Ocupada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-t-[2px] border border-gold/50" /> VIP
        </span>
      </div>
    </div>
  );
}
