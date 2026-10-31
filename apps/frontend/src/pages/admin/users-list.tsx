import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useAuthStore } from "@/features/auth/auth.store";
import type { Role } from "@/features/auth/auth.types";
import { useCreateUser, useUpdateUser, useUsers } from "@/features/users/users.hooks";
import type { AdminUser } from "@/features/users/users.types";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatNumber, initials } from "@/lib/format";

const ROLE_LABEL: Record<Role, string> = {
  CUSTOMER: "Cliente",
  BOX_OFFICE: "Taquilla",
  CINEMA_MANAGER: "Gerente de cine",
  SUPER_ADMIN: "Super admin",
};

const ROLES = Object.keys(ROLE_LABEL) as Role[];

const createUserFormSchema = z.object({
  firstName: z.string().trim().min(1, "El nombre es requerido").max(100),
  lastName: z.string().trim().min(1, "El apellido es requerido").max(100),
  email: z.string().trim().email("Email inválido"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[a-z]/, "Incluye una minúscula")
    .regex(/[A-Z]/, "Incluye una mayúscula")
    .regex(/[0-9]/, "Incluye un número"),
  role: z.enum(["CUSTOMER", "BOX_OFFICE", "CINEMA_MANAGER", "SUPER_ADMIN"]),
});

type CreateUserFormValues = z.infer<typeof createUserFormSchema>;

/** Solo SUPER_ADMIN gestiona cuentas; el backend lo exige tambien, esto evita mostrar una pantalla que fallaria. */
export function UsersListPage() {
  const me = useAuthStore((s) => s.user);
  if (me && me.role !== "SUPER_ADMIN") return <Navigate to="/admin" replace />;
  return <UsersListContent />;
}

function UsersListContent() {
  const me = useAuthStore((s) => s.user);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [toToggle, setToToggle] = useState<AdminUser | null>(null);

  const { data, isLoading } = useUsers({ search: query || undefined, role: role || undefined, page, pageSize: 15 });
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: { role: "BOX_OFFICE" },
  });

  async function onCreate(values: CreateUserFormValues) {
    try {
      await createMutation.mutateAsync(values);
      toast.success(`Cuenta creada para ${values.firstName}`);
      reset({ role: "BOX_OFFICE" });
      setShowForm(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos crear la cuenta"));
    }
  }

  async function changeRole(user: AdminUser, nextRole: Role) {
    try {
      await updateMutation.mutateAsync({ id: user.id, input: { role: nextRole } });
      toast.success(`${user.firstName} ahora es ${ROLE_LABEL[nextRole].toLowerCase()}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos cambiar el rol"));
    }
  }

  async function confirmToggle() {
    if (!toToggle) return;
    try {
      await updateMutation.mutateAsync({ id: toToggle.id, input: { isActive: !toToggle.isActive } });
      toast.success(toToggle.isActive ? "Cuenta desactivada y sesiones cerradas" : "Cuenta reactivada");
      setToToggle(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos actualizar la cuenta"));
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Equipo y clientes"
        title="Usuarios"
        description="Crea cuentas de taquilla o gerencia, cambia roles y desactiva accesos."
        action={
          <Button size="sm" onClick={() => setShowForm((v) => !v)} aria-expanded={showForm}>
            <Plus className="size-4" /> {showForm ? "Cerrar" : "Nueva cuenta"}
          </Button>
        }
      />

      {showForm && (
        <form
          onSubmit={handleSubmit(onCreate)}
          className="mt-5 grid gap-4 border border-hairline bg-surface p-5 sm:grid-cols-2"
        >
          <div className="space-y-1.5">
            <Label htmlFor="firstName">Nombre</Label>
            <Input id="firstName" autoComplete="off" {...register("firstName")} />
            {errors.firstName && <p className="text-xs text-danger">{errors.firstName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">Apellido</Label>
            <Input id="lastName" autoComplete="off" {...register("lastName")} />
            {errors.lastName && <p className="text-xs text-danger">{errors.lastName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="off" spellCheck={false} {...register("email")} />
            {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña inicial</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
            {errors.password && <p className="text-xs text-danger">{errors.password.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Rol</Label>
            <Select id="role" {...register("role")}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creando…" : "Crear cuenta"}
            </Button>
          </div>
        </form>
      )}

      <form
        className="mt-5 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
          setPage(1);
        }}
      >
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <Input
            aria-label="Buscar usuarios"
            placeholder="Buscar por nombre o email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="w-48">
          <Select
            aria-label="Filtrar por rol"
            value={role}
            onChange={(e) => {
              setRole(e.target.value as Role | "");
              setPage(1);
            }}
          >
            <option value="">Todos los roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      {isLoading && <p className="mt-6 text-sm text-ink-muted">Cargando usuarios…</p>}

      <div className="mt-4 divide-y divide-hairline border border-hairline">
        {data?.items.map((user) => {
          const isMe = user.id === me?.id;
          return (
            <div key={user.id} className="flex flex-wrap items-center gap-4 p-3">
              <div
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center border border-hairline bg-elevated font-display text-sm italic text-gold"
              >
                {initials(user.firstName, user.lastName)}
              </div>
              <div className="min-w-0 flex-1 basis-52">
                <p className="truncate text-sm text-ink">
                  {user.firstName} {user.lastName}
                  {isMe && <span className="ml-2 text-xs text-ink-muted">(tú)</span>}
                </p>
                <p className="truncate text-xs text-ink-muted">{user.email}</p>
              </div>
              {user.loyaltyMember && (
                <Badge tone="gold">{formatNumber(user.loyaltyPoints)} pts</Badge>
              )}
              <div className="w-44">
                <Select
                  aria-label={`Rol de ${user.firstName} ${user.lastName}`}
                  value={user.role}
                  disabled={isMe || updateMutation.isPending}
                  onChange={(e) => void changeRole(user, e.target.value as Role)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </Select>
              </div>
              <Badge tone={user.isActive ? "success" : "muted"}>{user.isActive ? "Activa" : "Desactivada"}</Badge>
              <Button
                variant="outline"
                size="sm"
                disabled={isMe}
                title={isMe ? "No puedes desactivar tu propia cuenta" : undefined}
                onClick={() => setToToggle(user)}
              >
                {user.isActive ? "Desactivar" : "Reactivar"}
              </Button>
            </div>
          );
        })}
        {data && data.items.length === 0 && (
          <p className="p-8 text-center text-sm text-ink-muted">No encontramos usuarios con ese filtro.</p>
        )}
      </div>

      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}

      <ConfirmDialog
        open={toToggle !== null}
        onOpenChange={(open) => !open && setToToggle(null)}
        title={toToggle?.isActive ? "¿Desactivar esta cuenta?" : "¿Reactivar esta cuenta?"}
        description={
          toToggle?.isActive
            ? `${toToggle.firstName} ${toToggle.lastName} no podrá iniciar sesión y se cerrarán sus sesiones abiertas. Sus compras y datos se conservan.`
            : `${toToggle?.firstName ?? ""} ${toToggle?.lastName ?? ""} podrá volver a iniciar sesión.`
        }
        confirmLabel={toToggle?.isActive ? "Sí, desactivar" : "Sí, reactivar"}
        destructive={toToggle?.isActive}
        isPending={updateMutation.isPending}
        onConfirm={() => void confirmToggle()}
      />
    </div>
  );
}
