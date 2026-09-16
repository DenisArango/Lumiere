import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CreditsEditor, type CreditRow } from "@/components/admin/credits-editor";
import { useGenres, useCreateMovie, useMovie, useUpdateMovie } from "@/features/movies/movies.hooks";
import { useRatings, useLanguages } from "@/features/reference-data/reference-data.hooks";
import { movieFormSchema, type MovieFormValues } from "@/features/movies/movies.schema";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function MovieFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const { data: genres } = useGenres();
  const { data: ratings } = useRatings();
  const { data: languages } = useLanguages();
  const { data: existingMovie } = useMovie(id);

  const createMutation = useCreateMovie();
  const updateMutation = useUpdateMovie(id ?? "");

  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const [credits, setCredits] = useState<CreditRow[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MovieFormValues>({
    resolver: zodResolver(movieFormSchema),
    defaultValues: { status: "COMING_SOON" },
  });

  useEffect(() => {
    if (!existingMovie) return;
    reset({
      title: existingMovie.title,
      originalTitle: existingMovie.originalTitle ?? "",
      synopsis: existingMovie.synopsis,
      durationMinutes: existingMovie.durationMinutes,
      releaseYear: existingMovie.releaseYear,
      countryOfOrigin: existingMovie.countryOfOrigin,
      posterUrl: existingMovie.posterUrl ?? "",
      backdropUrl: existingMovie.backdropUrl ?? "",
      trailerUrl: existingMovie.trailerUrl ?? "",
      status: existingMovie.status,
      ratingId: existingMovie.rating.id,
      originalLanguageId: existingMovie.originalLanguage.id,
    });
    setSelectedGenreIds(existingMovie.genres.map((g) => g.id));
    setCredits([
      ...existingMovie.directors.map((d, i) => ({
        personId: d.id,
        personLabel: `${d.firstName} ${d.lastName}`,
        creditRole: "DIRECTOR" as const,
        billingOrder: i,
      })),
      ...existingMovie.cast.map((c, i) => ({
        personId: c.id,
        personLabel: `${c.firstName} ${c.lastName}`,
        creditRole: "ACTOR" as const,
        characterName: c.characterName ?? undefined,
        billingOrder: i,
      })),
    ]);
  }, [existingMovie, reset]);

  function toggleGenre(genreId: string) {
    setSelectedGenreIds((prev) => (prev.includes(genreId) ? prev.filter((g) => g !== genreId) : [...prev, genreId]));
  }

  async function onSubmit(values: MovieFormValues) {
    if (selectedGenreIds.length === 0) {
      toast.error("Selecciona al menos un género");
      return;
    }
    if (!credits.some((c) => c.creditRole === "DIRECTOR")) {
      toast.error("Debes incluir al menos un director");
      return;
    }

    const payload = {
      ...values,
      originalTitle: values.originalTitle || undefined,
      posterUrl: values.posterUrl || undefined,
      backdropUrl: values.backdropUrl || undefined,
      trailerUrl: values.trailerUrl || undefined,
      genreIds: selectedGenreIds,
      credits: credits.map(({ personLabel: _personLabel, ...c }) => c),
    };

    try {
      if (isEditing) {
        await updateMutation.mutateAsync(payload);
        toast.success("Película actualizada");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Película creada");
      }
      navigate("/admin/peliculas");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos guardar la película"));
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <Link to="/admin/peliculas" className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> Volver
      </Link>
      <p className="eyebrow mt-4">{isEditing ? "Editar" : "Nueva"}</p>
      <h1 className="mt-1 font-display text-2xl italic text-ink">{isEditing ? existingMovie?.title : "Agregar película"}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 max-w-2xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="title">Título</Label>
            <Input id="title" {...register("title")} />
            {errors.title && <p className="text-xs text-danger">{errors.title.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="originalTitle">Título original</Label>
            <Input id="originalTitle" {...register("originalTitle")} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="synopsis">Sinopsis</Label>
          <Textarea id="synopsis" rows={4} {...register("synopsis")} />
          {errors.synopsis && <p className="text-xs text-danger">{errors.synopsis.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="durationMinutes">Duración (min)</Label>
            <Input id="durationMinutes" type="number" {...register("durationMinutes")} />
            {errors.durationMinutes && <p className="text-xs text-danger">{errors.durationMinutes.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="releaseYear">Año</Label>
            <Input id="releaseYear" type="number" {...register("releaseYear")} />
            {errors.releaseYear && <p className="text-xs text-danger">{errors.releaseYear.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="countryOfOrigin">País</Label>
            <Input id="countryOfOrigin" {...register("countryOfOrigin")} />
            {errors.countryOfOrigin && <p className="text-xs text-danger">{errors.countryOfOrigin.message}</p>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="ratingId">Clasificación</Label>
            <Select id="ratingId" {...register("ratingId")}>
              <option value="">Selecciona…</option>
              {ratings?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code}
                </option>
              ))}
            </Select>
            {errors.ratingId && <p className="text-xs text-danger">{errors.ratingId.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="originalLanguageId">Idioma original</Label>
            <Select id="originalLanguageId" {...register("originalLanguageId")}>
              <option value="">Selecciona…</option>
              {languages?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            {errors.originalLanguageId && <p className="text-xs text-danger">{errors.originalLanguageId.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Estado</Label>
            <Select id="status" {...register("status")}>
              <option value="COMING_SOON">Próximamente</option>
              <option value="IN_THEATERS">En cartelera</option>
              <option value="ARCHIVED">Archivada</option>
            </Select>
          </div>
        </div>

        <div>
          <Label>Géneros</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {genres?.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGenre(g.id)}
                className={cn(
                  "border px-2.5 py-1 text-xs font-medium transition-colors",
                  selectedGenreIds.includes(g.id)
                    ? "border-gold bg-gold text-black"
                    : "border-hairline text-ink-muted hover:text-ink",
                )}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="posterUrl">URL del póster</Label>
            <Input id="posterUrl" {...register("posterUrl")} />
            {errors.posterUrl && <p className="text-xs text-danger">{errors.posterUrl.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="backdropUrl">URL de fondo</Label>
            <Input id="backdropUrl" {...register("backdropUrl")} />
            {errors.backdropUrl && <p className="text-xs text-danger">{errors.backdropUrl.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trailerUrl">URL del tráiler</Label>
            <Input id="trailerUrl" {...register("trailerUrl")} />
            {errors.trailerUrl && <p className="text-xs text-danger">{errors.trailerUrl.message}</p>}
          </div>
        </div>

        <div>
          <Label>Dirección y reparto</Label>
          <div className="mt-2">
            <CreditsEditor credits={credits} onChange={setCredits} />
          </div>
        </div>

        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : isEditing ? "Guardar cambios" : "Crear película"}
        </Button>
      </form>
    </div>
  );
}
