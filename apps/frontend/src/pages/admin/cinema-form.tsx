import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateCinema } from "@/features/cinemas/cinemas.hooks";
import { cinemaFormSchema, type CinemaFormValues } from "@/features/cinemas/cinemas.schema";
import { getApiErrorMessage } from "@/lib/api-client";

export function CinemaFormPage() {
  const navigate = useNavigate();
  const createMutation = useCreateCinema();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CinemaFormValues>({ resolver: zodResolver(cinemaFormSchema) });

  async function onSubmit(values: CinemaFormValues) {
    try {
      const cinema = await createMutation.mutateAsync({ ...values, phone: values.phone || undefined });
      toast.success("Cine creado");
      navigate(`/admin/cines/${cinema.id}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos crear el cine"));
    }
  }

  return (
    <div>
      <Link to="/admin/cines" className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> Volver
      </Link>
      <p className="eyebrow mt-4">Nuevo</p>
      <h1 className="mt-1 font-display text-2xl italic text-ink">Agregar cine</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 max-w-md space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" {...register("name")} />
          {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">Dirección</Label>
          <Input id="address" {...register("address")} />
          {errors.address && <p className="text-xs text-danger">{errors.address.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="city">Ciudad</Label>
            <Input id="city" {...register("city")} />
            {errors.city && <p className="text-xs text-danger">{errors.city.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">Estado</Label>
            <Input id="state" {...register("state")} />
            {errors.state && <p className="text-xs text-danger">{errors.state.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="country">País</Label>
            <Input id="country" {...register("country")} />
            {errors.country && <p className="text-xs text-danger">{errors.country.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono (opcional)</Label>
            <Input id="phone" {...register("phone")} />
          </div>
        </div>
        <Button type="submit" size="lg" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creando…" : "Crear cine"}
        </Button>
      </form>
    </div>
  );
}
