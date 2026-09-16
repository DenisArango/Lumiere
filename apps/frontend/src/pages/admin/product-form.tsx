import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateProduct } from "@/features/products/products.hooks";
import { productFormSchema, type ProductFormValues } from "@/features/products/products.schema";
import { getApiErrorMessage } from "@/lib/api-client";

export function ProductFormPage() {
  const navigate = useNavigate();
  const createMutation = useCreateProduct();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormValues>({ resolver: zodResolver(productFormSchema), defaultValues: { isActive: true } });

  async function onSubmit(values: ProductFormValues) {
    try {
      await createMutation.mutateAsync({
        ...values,
        description: values.description || undefined,
        imageUrl: values.imageUrl || undefined,
      });
      toast.success("Producto creado");
      navigate("/admin/productos");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos crear el producto"));
    }
  }

  return (
    <div>
      <Link to="/admin/productos" className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> Volver
      </Link>
      <p className="eyebrow mt-4">Nuevo</p>
      <h1 className="mt-1 font-display text-2xl italic text-ink">Agregar producto</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 max-w-md space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" {...register("name")} placeholder="Combo grande" />
          {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Descripción (opcional)</Label>
          <Textarea id="description" rows={2} {...register("description")} placeholder="Palomitas grandes + refresco" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price">Precio</Label>
          <Input id="price" type="number" step="0.01" {...register("price")} />
          {errors.price && <p className="text-xs text-danger">{errors.price.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="imageUrl">URL de imagen (opcional)</Label>
          <Input id="imageUrl" {...register("imageUrl")} />
          {errors.imageUrl && <p className="text-xs text-danger">{errors.imageUrl.message}</p>}
        </div>
        <Button type="submit" size="lg" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creando…" : "Crear producto"}
        </Button>
      </form>
    </div>
  );
}
