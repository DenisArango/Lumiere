import { Plus, Trash2 } from "lucide-react";
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
    </div>
  );
}
