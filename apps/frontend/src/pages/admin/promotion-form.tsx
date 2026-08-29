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
import { Textarea } from "@/components/ui/textarea";
import { PromotionRulesEditor } from "@/components/admin/promotion-rules-editor";
import { useCreatePromotion } from "@/features/promotions/promotions.hooks";
import { promotionFormSchema, type PromotionFormValues } from "@/features/promotions/promotions.schema";
import type { PromotionRule } from "@/features/promotions/promotions.types";
import { getApiErrorMessage } from "@/lib/api-client";

export function PromotionFormPage() {
  const navigate = useNavigate();
  const createMutation = useCreatePromotion();
  const [rules, setRules] = useState<PromotionRule[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: { discountType: "PERCENTAGE", isActive: true },
  });

  async function onSubmit(values: PromotionFormValues) {
    try {
      await createMutation.mutateAsync({
        ...values,
        description: values.description || undefined,
        startDate: new Date(values.startDate).toISOString(),
        endDate: new Date(values.endDate).toISOString(),
        rules,
      });
      toast.success("Promoción creada");
      navigate("/admin/promociones");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos crear la promoción"));
    }
  }

  return (
    <div>
      <Link to="/admin/promociones" className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> Volver
      </Link>
      <p className="eyebrow mt-4">Nueva</p>
      <h1 className="mt-1 font-display text-2xl italic text-ink">Crear promoción</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 max-w-lg space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" {...register("name")} />
          {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Descripción (opcional)</Label>
          <Textarea id="description" rows={2} {...register("description")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="code">Código</Label>
          <Input id="code" {...register("code")} placeholder="EJ. LUMIERE20" />
          {errors.code && <p className="text-xs text-danger">{errors.code.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="discountType">Tipo de descuento</Label>
            <Select id="discountType" {...register("discountType")}>
              <option value="PERCENTAGE">Porcentaje</option>
              <option value="FIXED">Monto fijo</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discountValue">Valor</Label>
            <Input id="discountValue" type="number" step="0.01" {...register("discountValue")} />
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

        <Button type="submit" size="lg" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creando…" : "Crear promoción"}
        </Button>
      </form>
    </div>
  );
}
