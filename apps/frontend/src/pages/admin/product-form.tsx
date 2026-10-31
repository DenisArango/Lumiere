import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateProduct, useProductsAdmin, useUpdateProduct } from "@/features/products/products.hooks";
import { productFormSchema, type ProductFormValues } from "@/features/products/products.schema";
import { getApiErrorMessage } from "@/lib/api-client";

/** Crea un producto nuevo, o edita uno existente cuando la ruta trae :id. */
export function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { data: products } = useProductsAdmin();
  const existing = products?.find((p) => p.id === id);
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({ resolver: zodResolver(productFormSchema), defaultValues: { isActive: true } });

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        description: existing.description ?? "",
        price: Number(existing.price),
        imageUrl: existing.imageUrl ?? "",
        isActive: existing.isActive,
      });
    }
  }, [existing, reset]);

  async function onSubmit(values: ProductFormValues) {
    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({
          id,
          input: { ...values, description: values.description ?? "", imageUrl: values.imageUrl || undefined },
        });
        toast.success("Producto actualizado");
      } else {
        await createMutation.mutateAsync({
          ...values,
          description: values.description || undefined,
          imageUrl: values.imageUrl || undefined,
        });
        toast.success("Producto creado");
      }
      navigate("/admin/productos");
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, isEdit ? "No pudimos guardar el producto" : "No pudimos crear el producto"),
      );
    }
  }

  return (
    <div>
      <Link to="/admin/productos" className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> Volver
      </Link>
      <p className="eyebrow mt-4">{isEdit ? "Editar" : "Nuevo"}</p>
      <h1 className="mt-1 font-display text-3xl italic text-ink">
        {isEdit ? "Editar producto" : "Agregar producto"}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 max-w-md space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" autoComplete="off" {...register("name")} placeholder="Combo grande…" />
          {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Descripción (opcional)</Label>
          <Textarea id="description" rows={2} {...register("description")} placeholder="Palomitas grandes + refresco…" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price">Precio</Label>
          <Input id="price" type="number" step="0.01" inputMode="decimal" {...register("price")} />
          {errors.price && <p className="text-xs text-danger">{errors.price.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="imageUrl">URL de imagen (opcional)</Label>
          <Input id="imageUrl" type="url" autoComplete="off" spellCheck={false} {...register("imageUrl")} />
          {errors.imageUrl && <p className="text-xs text-danger">{errors.imageUrl.message}</p>}
        </div>
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear producto"}
        </Button>
      </form>
    </div>
  );
}
