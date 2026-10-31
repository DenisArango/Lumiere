import { useState } from "react";
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
import { PromotionRulesEditor } from "@/components/admin/promotion-rules-editor";
import { useCreatePromotion, usePromotion, useUpdatePromotion } from "@/features/promotions/promotions.hooks";
import { promotionFormSchema, type PromotionFormValues } from "@/features/promotions/promotions.schema";
import type { Promotion, PromotionRule } from "@/features/promotions/promotions.types";
import { getApiErrorMessage } from "@/lib/api-client";

/** Crea una promocion, o edita una existente cuando la ruta trae :id (el codigo y el tipo de descuento no cambian). */
export function PromotionFormPage() {
  const { id } = useParams<{ id: string }>();
  const { data: existing, isLoading } = usePromotion(id);

  if (id && isLoading) {
    return <p className="text-sm text-ink-muted">Cargando promoción…</p>;
  }
  if (id && !existing) {
    return <p className="text-sm text-ink-muted">No encontramos esta promoción.</p>;
  }

  // key: al cambiar de promocion el formulario se monta de cero con sus datos, sin efectos de sincronizacion.
  return <PromotionForm key={existing?.id ?? "new"} existing={existing} />;
}

function PromotionForm({ existing }: { existing: Promotion | undefined }) {
  const isEdit = existing !== undefined;
  const navigate = useNavigate();
  const createMutation = useCreatePromotion();
  const updateMutation = useUpdatePromotion();
  const isPending = createMutation.isPending || updateMutation.isPending;

  // El backend devuelve null en los criterios sin usar; el editor y la API esperan "ausente".
  const [rules, setRules] = useState<PromotionRule[]>(() =>
    (existing?.rules ?? []).map((r) => ({
      movieId: r.movieId ?? undefined,
      cinemaId: r.cinemaId ?? undefined,
      dayOfWeek: r.dayOfWeek ?? undefined,
    })),
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: existing
      ? {
          name: existing.name,
          description: existing.description ?? "",
          code: existing.code,
          discountType: existing.discountType,
          discountValue: Number(existing.discountValue),
          startDate: existing.startDate.slice(0, 10),
          endDate: existing.endDate.slice(0, 10),
          isActive: existing.isActive,
        }
      : { discountType: "PERCENTAGE", isActive: true },
  });

  async function onSubmit(values: PromotionFormValues) {
    const startDate = new Date(values.startDate).toISOString();
    const endDate = new Date(values.endDate).toISOString();
    try {
      if (existing) {
        await updateMutation.mutateAsync({
          id: existing.id,
          input: {
            name: values.name,
            description: values.description ?? "",
            discountValue: values.discountValue,
            startDate,
            endDate,
            isActive: values.isActive,
            rules,
          },
        });
        toast.success("Promoción actualizada");
      } else {
        await createMutation.mutateAsync({
          ...values,
          description: values.description || undefined,
          startDate,
          endDate,
          rules,
        });
        toast.success("Promoción creada");
      }
      navigate("/admin/promociones");
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, isEdit ? "No pudimos guardar la promoción" : "No pudimos crear la promoción"),
      );
    }
  }

  return (
    <div>
      <Link to="/admin/promociones" className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> Volver
      </Link>
      <p className="eyebrow mt-4">{isEdit ? "Editar" : "Nueva"}</p>
      <h1 className="mt-1 font-display text-3xl italic text-ink">
        {isEdit ? "Editar promoción" : "Crear promoción"}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 max-w-lg space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" autoComplete="off" {...register("name")} />
          {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Descripción (opcional)</Label>
          <Textarea id="description" rows={2} {...register("description")} />
        </div>

        {isEdit ? (
          <div className="border border-hairline bg-surface p-3 text-sm">
            <p className="text-ink-muted">
              Código <span className="font-semibold tracking-wider text-gold">{existing?.code}</span> ·{" "}
              {existing?.discountType === "PERCENTAGE" ? "Porcentaje" : "Monto fijo"}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              El código y el tipo de descuento no se pueden cambiar. Para otro código, crea una promoción nueva.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="code">Código</Label>
            <Input id="code" autoComplete="off" spellCheck={false} {...register("code")} placeholder="EJ. LUMIERE20" />
            {errors.code && <p className="text-xs text-danger">{errors.code.message}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="discountType">Tipo de descuento</Label>
              <Select id="discountType" {...register("discountType")}>
                <option value="PERCENTAGE">Porcentaje</option>
                <option value="FIXED">Monto fijo</option>
              </Select>
            </div>
          )}
          <div className={isEdit ? "col-span-2 space-y-1.5" : "space-y-1.5"}>
            <Label htmlFor="discountValue">Valor</Label>
            <Input id="discountValue" type="number" step="0.01" inputMode="decimal" {...register("discountValue")} />
            {errors.discountValue && <p className="text-xs text-danger">{errors.discountValue.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="startDate">Inicia</Label>
            <Input id="startDate" type="date" {...register("startDate")} />
            {errors.startDate && <p className="text-xs text-danger">{errors.startDate.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endDate">Termina</Label>
            <Input id="endDate" type="date" {...register("endDate")} />
            {errors.endDate && <p className="text-xs text-danger">{errors.endDate.message}</p>}
          </div>
        </div>

        <div>
          <Label>Reglas de aplicación</Label>
          <div className="mt-2">
            <PromotionRulesEditor rules={rules} onChange={setRules} />
          </div>
        </div>

        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear promoción"}
        </Button>
      </form>
    </div>
  );
}
