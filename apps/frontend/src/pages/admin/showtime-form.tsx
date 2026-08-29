import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useMovies } from "@/features/movies/movies.hooks";
import { useCinemas, useRoomsByCinema } from "@/features/cinemas/cinemas.hooks";
import { useLanguages } from "@/features/reference-data/reference-data.hooks";
import { useCreateShowtime } from "@/features/showtimes/showtimes.hooks";
import { showtimeFormSchema, type ShowtimeFormValues } from "@/features/showtimes/showtimes.schema";
import { getApiErrorMessage } from "@/lib/api-client";

export function ShowtimeFormPage() {
  const navigate = useNavigate();
  const { data: movies } = useMovies({ pageSize: 100 });
  const { data: cinemas } = useCinemas();
  const { data: languages } = useLanguages();
  const createMutation = useCreateShowtime();

  const [selectedCinemaId, setSelectedCinemaId] = useState("");
  const { data: rooms } = useRoomsByCinema(selectedCinemaId || undefined);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ShowtimeFormValues>({ resolver: zodResolver(showtimeFormSchema), defaultValues: { format: "TWO_D" } });

  async function onSubmit(values: ShowtimeFormValues) {
    try {
      await createMutation.mutateAsync({
        movieId: values.movieId,
        roomId: values.roomId,
        audioLanguageId: values.audioLanguageId,
        subtitleLanguageId: values.subtitleLanguageId || undefined,
        startTime: new Date(values.startTime).toISOString(),
        basePrice: values.basePrice,
        format: values.format,
      });
      toast.success("Función creada");
      navigate("/admin/funciones");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos crear la función"));
    }
  }

  return (
    <div>
      <Link to="/admin/funciones" className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> Volver
      </Link>
      <p className="eyebrow mt-4">Nueva</p>
      <h1 className="mt-1 font-display text-2xl italic text-ink">Programar función</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 max-w-md space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="movieId">Película</Label>
          <Select id="movieId" {...register("movieId")}>
            <option value="">Selecciona…</option>
            {movies?.items.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </Select>
          {errors.movieId && <p className="text-xs text-danger">{errors.movieId.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cinemaId">Cine</Label>
          <Select
            id="cinemaId"
            value={selectedCinemaId}
            onChange={(e) => {
              setSelectedCinemaId(e.target.value);
              setValue("roomId", "");
            }}
          >
            <option value="">Selecciona…</option>
            {cinemas?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.city}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="roomId">Sala</Label>
          <Select id="roomId" disabled={!selectedCinemaId} {...register("roomId")}>
            <option value="">Selecciona…</option>
            {rooms?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.totalCapacity} butacas)
              </option>
            ))}
          </Select>
          {errors.roomId && <p className="text-xs text-danger">{errors.roomId.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="audioLanguageId">Idioma de audio</Label>
            <Select id="audioLanguageId" {...register("audioLanguageId")}>
              <option value="">Selecciona…</option>
              {languages?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            {errors.audioLanguageId && <p className="text-xs text-danger">{errors.audioLanguageId.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subtitleLanguageId">Subtítulos (opcional)</Label>
            <Select id="subtitleLanguageId" {...register("subtitleLanguageId")}>
              <option value="">Sin subtítulos</option>
              {languages?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="startTime">Fecha y hora</Label>
            <Input id="startTime" type="datetime-local" {...register("startTime")} />
            {errors.startTime && <p className="text-xs text-danger">{errors.startTime.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="format">Formato</Label>
            <Select id="format" {...register("format")}>
              <option value="TWO_D">2D</option>
              <option value="THREE_D">3D</option>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="basePrice">Precio base</Label>
          <Input id="basePrice" type="number" step="0.01" {...register("basePrice")} />
          {errors.basePrice && <p className="text-xs text-danger">{errors.basePrice.message}</p>}
        </div>

        <Button type="submit" size="lg" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creando…" : "Programar función"}
        </Button>
      </form>
    </div>
  );
}
