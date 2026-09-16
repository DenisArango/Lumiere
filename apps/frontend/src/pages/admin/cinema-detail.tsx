import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, DoorOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { RoomRowsEditor } from "@/components/admin/room-rows-editor";
import { useCinema, useCreateRoom } from "@/features/cinemas/cinemas.hooks";
import { roomFormSchema, type RoomFormValues } from "@/features/cinemas/cinemas.schema";
import type { RoomRowInput } from "@/features/cinemas/cinemas.types";
import { getApiErrorMessage } from "@/lib/api-client";

const ROOM_TYPE_LABEL: Record<string, string> = {
  STANDARD: "Estándar",
  IMAX: "IMAX",
  VIP: "VIP",
  FOUR_DX: "4DX",
  DOLBY_ATMOS: "Dolby Atmos",
};

export function CinemaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: cinema } = useCinema(id);
  const createRoomMutation = useCreateRoom(id ?? "");

  const [showRoomForm, setShowRoomForm] = useState(false);
  const [rows, setRows] = useState<RoomRowInput[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoomFormValues>({ resolver: zodResolver(roomFormSchema), defaultValues: { roomType: "STANDARD" } });

  async function onSubmit(values: RoomFormValues) {
    if (rows.length === 0) {
      toast.error("Agrega al menos una fila de butacas");
      return;
    }
    if (rows.some((r) => !r.seatTypeId)) {
      toast.error("Selecciona el tipo de butaca en cada fila");
      return;
    }
    try {
      await createRoomMutation.mutateAsync({ ...values, rows });
      toast.success("Sala creada");
      reset();
      setRows([]);
      setShowRoomForm(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos crear la sala"));
    }
  }

  if (!cinema) return null;

  return (
    <div>
      <Link to="/admin/cines" className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> Volver
      </Link>
      <p className="eyebrow mt-4">{cinema.city}</p>
      <h1 className="mt-1 font-display text-2xl italic text-ink">{cinema.name}</h1>
      <p className="mt-1 text-sm text-ink-muted">{cinema.address}</p>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="eyebrow">Salas</h2>
        <Button size="sm" variant="outline" onClick={() => setShowRoomForm((v) => !v)}>
          <Plus className="size-3.5" /> {showRoomForm ? "Cancelar" : "Agregar sala"}
        </Button>
      </div>

      {showRoomForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4 border border-hairline p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="roomName">Nombre de la sala</Label>
              <Input id="roomName" {...register("name")} />
              {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="roomType">Tipo</Label>
              <Select id="roomType" {...register("roomType")}>
                {Object.entries(ROOM_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label>Mapa de butacas</Label>
            <div className="mt-2">
              <RoomRowsEditor rows={rows} onChange={setRows} />
            </div>
          </div>

          <Button type="submit" disabled={createRoomMutation.isPending}>
            {createRoomMutation.isPending ? "Creando…" : "Guardar sala"}
          </Button>
        </form>
      )}

      <div className="mt-4 divide-y divide-hairline border border-hairline">
        {cinema.rooms.map((room) => (
          <div key={room.id} className="flex items-center gap-3 p-3">
            <DoorOpen className="size-4 text-ink-muted" />
            <div className="flex-1">
              <p className="text-sm text-ink">{room.name}</p>
              <p className="text-xs text-ink-muted">
                {ROOM_TYPE_LABEL[room.roomType]} · {room.totalCapacity} butacas
              </p>
            </div>
          </div>
        ))}
        {cinema.rooms.length === 0 && (
          <p className="p-4 text-center text-sm text-ink-muted">Sin salas todavía.</p>
        )}
      </div>
    </div>
  );
}
