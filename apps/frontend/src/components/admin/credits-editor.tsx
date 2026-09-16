import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { searchPeople, createPerson } from "@/features/people/people.api";
import type { PersonSummary } from "@/features/people/people.types";
import type { MovieCreditInput } from "@/features/movies/movies.types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CreditRow extends MovieCreditInput {
  personLabel: string;
}

interface CreditsEditorProps {
  credits: CreditRow[];
  onChange: (credits: CreditRow[]) => void;
}

export function CreditsEditor({ credits, onChange }: CreditsEditorProps) {
  const [query, setQuery] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");

  const { data: results } = useQuery({
    queryKey: ["people-search", query],
    queryFn: () => searchPeople(query),
    enabled: query.trim().length > 1,
  });

  function addPerson(person: PersonSummary) {
    onChange([
      ...credits,
      {
        personId: person.id,
        personLabel: `${person.firstName} ${person.lastName}`,
        creditRole: "ACTOR",
        billingOrder: credits.length,
      },
    ]);
    setQuery("");
  }

  async function handleCreateNew() {
    if (!newFirstName.trim() || !newLastName.trim()) return;
    const person = await createPerson({ firstName: newFirstName.trim(), lastName: newLastName.trim() });
    addPerson(person);
    setNewFirstName("");
    setNewLastName("");
    setCreatingNew(false);
  }

  function updateRow(index: number, patch: Partial<CreditRow>) {
    onChange(credits.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function removeRow(index: number) {
    onChange(credits.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar director o actor por nombre…"
        />
        {query.trim().length > 1 && (
          <div className="absolute z-10 mt-1 w-full border border-hairline bg-elevated shadow-lg">
            {results?.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addPerson(p)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-surface"
              >
                <Plus className="size-3.5 text-gold" /> {p.firstName} {p.lastName}
              </button>
            ))}
            {results?.length === 0 && (
              <button
                type="button"
                onClick={() => {
                  setCreatingNew(true);
                  setNewFirstName(query.split(" ")[0] ?? "");
                  setNewLastName(query.split(" ").slice(1).join(" "));
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gold hover:bg-surface"
              >
                <UserPlus className="size-3.5" /> Crear "{query}" como persona nueva
              </button>
            )}
          </div>
        )}
      </div>

      {creatingNew && (
        <div className="mt-2 flex items-end gap-2 border border-hairline p-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-ink-muted">Nombre</label>
            <Input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs text-ink-muted">Apellido</label>
            <Input value={newLastName} onChange={(e) => setNewLastName(e.target.value)} />
          </div>
          <Button type="button" size="sm" onClick={() => void handleCreateNew()}>
            Agregar
          </Button>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {credits.map((credit, i) => (
          <div key={`${credit.personId}-${i}`} className="flex items-center gap-2 border border-hairline px-3 py-2">
            <span className="flex-1 text-sm text-ink">{credit.personLabel}</span>
            <div className="flex overflow-hidden border border-hairline">
              {(["DIRECTOR", "ACTOR"] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => updateRow(i, { creditRole: role })}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium",
                    credit.creditRole === role ? "bg-gold text-black" : "text-ink-muted hover:text-ink",
                  )}
                >
                  {role === "DIRECTOR" ? "Director" : "Actor"}
                </button>
              ))}
            </div>
            {credit.creditRole === "ACTOR" && (
              <Input
                value={credit.characterName ?? ""}
                onChange={(e) => updateRow(i, { characterName: e.target.value })}
                placeholder="Personaje"
                className="h-8 w-36"
              />
            )}
            <button type="button" onClick={() => removeRow(i)} className="text-ink-muted hover:text-danger">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        {credits.length === 0 && <p className="text-xs text-ink-muted">Sin reparto agregado todavía.</p>}
      </div>
    </div>
  );
}
