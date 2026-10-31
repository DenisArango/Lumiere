import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Check, DoorOpen, Pencil, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { RoomRowsEditor } from "@/components/admin/room-rows-editor";
import { useCinema, useCreateRoom, useUpdateCinema, useUpdateRoom } from "@/features/cinemas/cinemas.hooks";
import { roomFormSchema, type RoomFormValues } from "@/features/cinemas/cinemas.schema";
import type { Room, RoomRowInput, RoomType } from "@/features/cinemas/cinemas.types";
import { getApiErrorMessage } from "@/lib/api-client";

const ROOM_TYPE_LABEL: Record<string, string> = {
  STANDARD: "Estándar",
  IMAX: "IMAX",
  VIP: "VIP",
  FOUR_DX: "4DX",
  DOLBY_ATMOS: "Dolby Atmos",
};

function RoomEditRow({ room, cinemaId, onDone }: { room: Room; cinemaId: string; onDone: () => void }) {
  const updateMutation = useUpdateRoom(cinemaId);
  const [name, setName] = useState(room.name);
  const [roomType, setRoomType] = useState<RoomType>(room.roomType);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await updateMutation.mutateAsync({ roomId: room.id, input: { name: name.trim(), roomType } });
      toast.success("Sala actualizada");
      onDone();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos actualizar la sala"));
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} className="flex flex-wrap items-center gap-2 p-3">
      <DoorOpen className="size-4 text-ink-muted" />
      <Input
        aria-label="Nombre de la sala"
        value={name}
        maxLength={50}
        onChange={(e) => setName(e.target.value)}
        className="h-8 w-48"
        autoFocus
      />
      <div className="w-40">
        <Select
          aria-label="Tipo de sala"
          value={roomType}
          onChange={(e) => setRoomType(e.target.value as RoomType)}
          className="h-8"
        >
          {Object.entries(ROOM_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" size="sm" disabled={updateMutation.isPending} aria-label="Guardar sala">
        <Check className="size-3.5" />
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onDone} aria-label="Cancelar edición">
        <X className="size-3.5" />
      </Button>
    </form>
  );
}

export function CinemaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: cinema } = useCinema(id);
  const createRoomMutation = useCreateRoom(id ?? "");
  const updateCinemaMutation = useUpdateCinema(id ?? "");

  const [showRoomForm, setShowRoomForm] = useState(false);
  const [rows, setRows] = useState<RoomRowInput[]>([]);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [confirmToggle, setConfirmToggle] = useState(false);

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

  async function toggleActive() {
    if (!cinema) return;
    try {
      await updateCinemaMutation.mutateAsync({ isActive: !cinema.isActive });
      toast.success(cinema.isActive ? "Cine desactivado" : "Cine reactivado");
      setConfirmToggle(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos actualizar el cine"));
    }
  }

  if (!cinema) return null;

  return (
    <div>
      <Link to="/admin/cines" className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> Volver
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-5">
        <div>
          <p className="eyebrow">{cinema.city}</p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 font-display text-3xl italic text-ink">
            {cinema.name}
            {!cinema.isActive && <Badge>Desactivado</Badge>}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{cinema.address}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/admin/cines/${cinema.id}/editar`}>
              <Pencil className="size-3.5" /> Editar
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfirmToggle(true)}>
            {cinema.isActive ? "Desactivar" : "Reactivar"}
          </Button>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="eyebrow">Salas</h2>
        <Button size="sm" variant="outline" onClick={() => setShowRoomForm((v) => !v)} aria-expanded={showRoomForm}>
          <Plus className="size-3.5" /> {showRoomForm ? "Cancelar" : "Agregar sala"}
        </Button>
      </div>

      {showRoomForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4 border border-hairline p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="roomName">Nombre de la sala</Label>
              <Input id="roomName" autoComplete="off" {...register("name")} />
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
        {cinema.rooms.map((room) =>
          editingRoomId === room.id ? (
            <RoomEditRow key={room.id} room={room} cinemaId={cinema.id} onDone={() => setEditingRoomId(null)} />
          ) : (
            <div key={room.id} className="flex items-center gap-3 p-3">
              <DoorOpen className="size-4 text-ink-muted" />
              <div className="flex-1">
                <p className="text-sm text-ink">{room.name}</p>
                <p className="text-xs text-ink-muted">
                  {ROOM_TYPE_LABEL[room.roomType]} · {room.totalCapacity} butacas
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditingRoomId(room.id)}>
                <Pencil className="size-3.5" /> Editar
              </Button>
            </div>
          ),
        )}
        {cinema.rooms.length === 0 && <p className="p-6 text-center text-sm text-ink-muted">Sin salas todavía.</p>}
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        El mapa de butacas de una sala creada no se puede regenerar: se edita el nombre y el tipo.
      </p>

      <ConfirmDialog
        open={confirmToggle}
        onOpenChange={setConfirmToggle}
        title={cinema.isActive ? "¿Desactivar este cine?" : "¿Reactivar este cine?"}
        description={
          cinema.isActive
            ? `“${cinema.name}” dejará de aparecer en la cartelera pública. Sus salas, funciones y ventas se conservan.`
            : `“${cinema.name}” volverá a mostrarse al público.`
        }
        confirmLabel={cinema.isActive ? "Sí, desactivar" : "Sí, reactivar"}
        destructive={cinema.isActive}
        isPending={updateCinemaMutation.isPending}
        onConfirm={() => void toggleActive()}
      />
    </div>
  );
}
