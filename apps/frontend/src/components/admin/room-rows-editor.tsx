import { Accessibility, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useSeatTypes } from "@/features/reference-data/reference-data.hooks";
import type { RoomRowInput } from "@/features/cinemas/cinemas.types";

interface RoomRowsEditorProps {
  rows: RoomRowInput[];
  onChange: (rows: RoomRowInput[]) => void;
}

/** Constructor del layout fisico de butacas: una fila por cada renglon real de la sala (letra, cantidad, tipo de butaca) - ver POST /cinemas/:id/rooms. */
export function RoomRowsEditor({ rows, onChange }: RoomRowsEditorProps) {
  const { data: seatTypes } = useSeatTypes();

  function addRow() {
    const nextLetter = String.fromCharCode(65 + rows.length);
    onChange([...rows, { rowLabel: nextLetter, seatCount: 10, seatTypeId: seatTypes?.[0]?.id ?? "" }]);
  }

  function updateRow(index: number, patch: Partial<RoomRowInput>) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  const totalSeats = rows.reduce((sum, r) => sum + (r.seatCount || 0), 0);

  return (
    <div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={row.rowLabel}
              onChange={(e) => updateRow(i, { rowLabel: e.target.value.toUpperCase() })}
              maxLength={2}
              className="w-14 text-center"
              placeholder="Fila"
            />
            <Input
              type="number"
              min={1}
              value={row.seatCount}
              onChange={(e) => updateRow(i, { seatCount: Number(e.target.value) })}
              className="w-24"
              placeholder="Butacas"
            />
            <Select
              value={row.seatTypeId}
              onChange={(e) => updateRow(i, { seatTypeId: e.target.value })}
              className="flex-1"
            >
              <option value="">Tipo de butaca…</option>
              {seatTypes?.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </Select>
            <button type="button" onClick={() => removeRow(i)} className="text-ink-muted hover:text-danger">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-3.5" /> Agregar fila
        </Button>
        <p className="text-xs text-ink-muted">{totalSeats} butacas en total</p>
      </div>

      <RoomPreview rows={rows} seatTypes={seatTypes ?? []} />
    </div>
  );
}

type SeatTypeInfo = { id: string; name: string };

/** Estilo de una butaca segun su tipo: mismos criterios que el mapa que ve el cliente al comprar. */
function seatStyle(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("vip")) return "border-gold bg-gold/20 text-gold";
  if (n.includes("reclin")) return "border-crimson bg-crimson/30 text-ink";
  return "border-hairline bg-transparent text-ink-muted";
}

/**
 * Vista previa EN VIVO de la sala: se redibuja con cada letra o numero que se escribe, para ver como va quedando
 * antes de guardar (el mapa no se puede regenerar despues de crear la sala).
 */
function RoomPreview({ rows, seatTypes }: { rows: RoomRowInput[]; seatTypes: SeatTypeInfo[] }) {
  if (rows.length === 0) {
    return (
      <p className="mt-5 border border-dashed border-hairline p-6 text-center text-sm text-ink-muted">
        Agrega una fila y aquí verás cómo queda la sala.
      </p>
    );
  }

  const labels = rows.map((r) => r.rowLabel.trim().toUpperCase()).filter(Boolean);
  const duplicated = labels.filter((l, i) => labels.indexOf(l) !== i);
  const typeOf = (id: string) => seatTypes.find((t) => t.id === id);
  const usedTypes = seatTypes.filter((t) => rows.some((r) => r.seatTypeId === t.id));
  const hasUntyped = rows.some((r) => !r.seatTypeId);

  return (
    <div className="mt-5 border border-hairline bg-surface p-4" aria-label="Vista previa de la sala">
      <p className="eyebrow">Vista previa de la sala</p>

      <div className="mx-auto mt-4 max-w-md">
        <div className="h-1.5 rounded-t-full bg-gold/70" aria-hidden />
        <p className="mt-1 text-center text-xs uppercase tracking-[0.3em] text-ink-muted">Pantalla</p>
      </div>

      <div className="mt-4 space-y-1.5 overflow-x-auto pb-1">
        {rows.map((row, ri) => {
          const type = typeOf(row.seatTypeId);
          const count = Math.min(Math.max(Math.floor(row.seatCount) || 0, 0), 60);
          return (
            <div key={ri} className="flex items-center justify-center gap-1.5">
              <span className="w-5 text-right text-xs text-ink-muted">{row.rowLabel || "?"}</span>
              <div className="flex gap-1">
                {Array.from({ length: count }, (_, i) => (
                  <span key={i} className="flex">
                    {i > 0 && i % 5 === 0 && <span className="w-3" aria-hidden />}
                    <span
                      title={`Fila ${row.rowLabel || "?"}, butaca ${i + 1}${type ? ` · ${type.name}` : ""}`}
                      className={cn(
                        "flex size-6 items-center justify-center rounded-t-[3px] rounded-b-sm border text-[0.625rem]",
                        type ? seatStyle(type.name) : "border-dashed border-danger/60 text-danger",
                      )}
                    >
                      {type?.name.toLowerCase().includes("silla") ? <Accessibility className="size-3" /> : i + 1}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        {usedTypes.map((t) => (
          <span key={t.id} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-sm border", seatStyle(t.name))} aria-hidden /> {t.name}
          </span>
        ))}
        {hasUntyped && <span className="text-danger">Hay filas sin tipo de butaca</span>}
      </div>
      {duplicated.length > 0 && (
        <p className="mt-2 text-xs text-danger">
          Hay filas con la misma letra ({[...new Set(duplicated)].join(", ")}): cada fila debe tener una letra distinta.
        </p>
      )}
    </div>
  );
}
