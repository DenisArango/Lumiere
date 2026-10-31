import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ExternalLink, Pencil, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/features/auth/auth.store";
import { useCreateGenre, useGenres } from "@/features/movies/movies.hooks";
import { usePeople, useUpdatePerson } from "@/features/people/people.hooks";
import type { Person } from "@/features/people/people.types";
import { getApiErrorMessage } from "@/lib/api-client";

interface PersonFormValues {
  firstName: string;
  lastName: string;
  nationality: string;
  photoUrl: string;
  bio: string;
}

function PersonEditor({ person, onDone }: { person: Person; onDone: () => void }) {
  const updateMutation = useUpdatePerson();
  const { register, handleSubmit } = useForm<PersonFormValues>({
    defaultValues: {
      firstName: person.firstName,
      lastName: person.lastName,
      nationality: person.nationality ?? "",
      photoUrl: person.photoUrl ?? "",
      bio: person.bio ?? "",
    },
  });

  async function onSubmit(values: PersonFormValues) {
    try {
      await updateMutation.mutateAsync({
        id: person.id,
        input: {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          nationality: values.nationality.trim() || undefined,
          photoUrl: values.photoUrl.trim() || undefined,
          bio: values.bio.trim() || undefined,
        },
      });
      toast.success("Persona actualizada");
      onDone();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos guardar los cambios"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 bg-surface p-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`fn-${person.id}`}>Nombre</Label>
        <Input id={`fn-${person.id}`} autoComplete="off" {...register("firstName", { required: true })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`ln-${person.id}`}>Apellido</Label>
        <Input id={`ln-${person.id}`} autoComplete="off" {...register("lastName", { required: true })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`nat-${person.id}`}>Nacionalidad</Label>
        <Input id={`nat-${person.id}`} autoComplete="off" {...register("nationality")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`photo-${person.id}`}>URL de la foto</Label>
        <Input id={`photo-${person.id}`} type="url" autoComplete="off" spellCheck={false} {...register("photoUrl")} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`bio-${person.id}`}>Biografía</Label>
        <Textarea id={`bio-${person.id}`} rows={3} {...register("bio")} />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? "Guardando…" : "Guardar"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function PeopleSection() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data, isLoading } = usePeople({ search: query || undefined, page });

  return (
    <section aria-labelledby="people-title" className="mt-8">
      <h2 id="people-title" className="eyebrow">
        Directores y actores
      </h2>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
          setPage(1);
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <Input
            aria-label="Buscar personas"
            placeholder="Buscar por nombre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      {isLoading && <p className="mt-4 text-sm text-ink-muted">Cargando personas…</p>}

      <div className="mt-3 divide-y divide-hairline border border-hairline">
        {data?.items.map((person) =>
          editingId === person.id ? (
            <PersonEditor key={person.id} person={person} onDone={() => setEditingId(null)} />
          ) : (
            <div key={person.id} className="flex items-center gap-4 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-display italic text-ink">
                  {person.firstName} {person.lastName}
                </p>
                <p className="truncate text-xs text-ink-muted">
                  {person.nationality ?? "Nacionalidad sin registrar"}
                  {person.bio ? "" : " · sin biografía"}
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/personas/${person.id}`} aria-label={`Ver perfil público de ${person.firstName}`}>
                  <ExternalLink className="size-3.5" />
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditingId(person.id)}>
                <Pencil className="size-3.5" /> Editar
              </Button>
            </div>
          ),
        )}
        {data && data.items.length === 0 && (
          <p className="p-8 text-center text-sm text-ink-muted">No encontramos personas con ese nombre.</p>
        )}
      </div>

      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}
    </section>
  );
}

function GenresSection() {
  const role = useAuthStore((s) => s.user?.role);
  const { data: genres } = useGenres();
  const createMutation = useCreateGenre();
  const [name, setName] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    try {
      await createMutation.mutateAsync(value);
      toast.success(`Género “${value}” creado`);
      setName("");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No pudimos crear el género"));
    }
  }

  return (
    <section aria-labelledby="genres-title" className="mt-10">
      <h2 id="genres-title" className="eyebrow">
        Géneros
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {genres?.map((genre) => (
          <li key={genre.id} className="border border-hairline px-3 py-1 text-sm text-ink-muted">
            {genre.name}
          </li>
        ))}
        {genres && genres.length === 0 && <li className="text-sm text-ink-muted">Todavía no hay géneros.</li>}
      </ul>
      {role !== "SUPER_ADMIN" && (
        <p className="mt-4 text-xs text-ink-muted">Solo un super admin puede agregar géneros nuevos.</p>
      )}
      <form onSubmit={(e) => void onSubmit(e)} className={role === "SUPER_ADMIN" ? "mt-4 flex max-w-md gap-2" : "hidden"}>
        <Input
          aria-label="Nombre del nuevo género"
          placeholder="Ej. Cine negro…"
          value={name}
          maxLength={50}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
        <Button type="submit" disabled={createMutation.isPending || name.trim() === ""}>
          <Plus className="size-4" /> Agregar
        </Button>
      </form>
    </section>
  );
}

export function CatalogPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Catálogo"
        title="Personas y géneros"
        description="Corrige datos de directores y actores, y amplía los géneros disponibles al crear películas."
      />
      <PeopleSection />
      <GenresSection />
    </div>
  );
}
