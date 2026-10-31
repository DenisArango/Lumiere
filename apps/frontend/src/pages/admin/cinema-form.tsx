import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCinema, useCreateCinema, useUpdateCinema } from "@/features/cinemas/cinemas.hooks";
import { cinemaFormSchema, type CinemaFormValues } from "@/features/cinemas/cinemas.schema";
import { getApiErrorMessage } from "@/lib/api-client";

/** Crea un cine nuevo, o edita uno existente cuando la ruta trae :id. */
export function CinemaFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { data: existing } = useCinema(id);
  const createMutation = useCreateCinema();
  const updateMutation = useUpdateCinema(id ?? "");
  const isPending = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CinemaFormValues>({ resolver: zodResolver(cinemaFormSchema) });

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        address: existing.address,
        city: existing.city,
        state: existing.state,
        country: existing.country,
        phone: existing.phone ?? "",
      });
    }
  }, [existing, reset]);

  async function onSubmit(values: CinemaFormValues) {
    const input = { ...values, phone: values.phone || undefined };
    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync(input);
        toast.success("Cine actualizado");
        navigate(`/admin/cines/${id}`);
      } else {
        const cinema = await createMutation.mutateAsync(input);
        toast.success("Cine creado");
        navigate(`/admin/cines/${cinema.id}`);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, isEdit ? "No pudimos guardar el cine" : "No pudimos crear el cine"));
    }
  }

  return (
    <div>
      <Link
        to={isEdit && id ? `/admin/cines/${id}` : "/admin/cines"}
        className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Volver
      </Link>
      <p className="eyebrow mt-4">{isEdit ? "Editar" : "Nuevo"}</p>
      <h1 className="mt-1 font-display text-3xl italic text-ink">{isEdit ? "Editar cine" : "Agregar cine"}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 max-w-md space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" {...register("name")} />
          {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">Dirección</Label>
          <Input id="address" autoComplete="off" {...register("address")} />
          {errors.address && <p className="text-xs text-danger">{errors.address.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="city">Ciudad</Label>
            <Input id="city" autoComplete="off" {...register("city")} />
            {errors.city && <p className="text-xs text-danger">{errors.city.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">Estado</Label>
            <Input id="state" autoComplete="off" {...register("state")} />
            {errors.state && <p className="text-xs text-danger">{errors.state.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="country">País</Label>
            <Input id="country" autoComplete="off" {...register("country")} />
            {errors.country && <p className="text-xs text-danger">{errors.country.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono (opcional)</Label>
            <Input id="phone" type="tel" inputMode="tel" autoComplete="off" {...register("phone")} />
          </div>
        </div>
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear cine"}
        </Button>
      </form>
    </div>
  );
}
