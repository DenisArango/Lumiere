import { Plus, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useMovies } from "@/features/movies/movies.hooks";
import { useCinemas } from "@/features/cinemas/cinemas.hooks";
import type { PromotionRule } from "@/features/promotions/promotions.types";

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type RuleKind = "movie" | "cinema" | "day";

function kindOf(rule: PromotionRule): RuleKind {
  if (rule.movieId) return "movie";
  if (rule.cinemaId) return "cinema";
  return "day";
}

interface PromotionRulesEditorProps {
  rules: PromotionRule[];
  onChange: (rules: PromotionRule[]) => void;
}

/** Sin reglas = promocion global (aplica a cualquier funcion) - ver docs/backend/06-promociones.md. */
export function PromotionRulesEditor({ rules, onChange }: PromotionRulesEditorProps) {
  const { data: movies } = useMovies({ pageSize: 100 });
  const { data: cinemas } = useCinemas();

  function addRule() {
    onChange([...rules, { dayOfWeek: 0 }]);
  }

  function updateRule(index: number, rule: PromotionRule) {
    onChange(rules.map((r, i) => (i === index ? rule : r)));
  }

  function removeRule(index: number) {
    onChange(rules.filter((_, i) => i !== index));
  }

  return (
    <div>
      {rules.length === 0 && (
        <p className="text-xs text-ink-muted">Sin reglas: la promoción aplica a cualquier función.</p>
      )}
      <div className="space-y-2">
        {rules.map((rule, i) => {
          const kind = kindOf(rule);
          return (
            <div key={i} className="flex items-center gap-2">
              <Select
                value={kind}
                onChange={(e) => {
                  const next = e.target.value as RuleKind;
                  if (next === "movie") updateRule(i, { movieId: movies?.items[0]?.id ?? "" });
                  else if (next === "cinema") updateRule(i, { cinemaId: cinemas?.items[0]?.id ?? "" });
                  else updateRule(i, { dayOfWeek: 0 });
                }}
                className="w-40"
              >
                <option value="movie">Por película</option>
                <option value="cinema">Por cine</option>
                <option value="day">Por día de semana</option>
              </Select>

              {kind === "movie" && (
                <Select value={rule.movieId} onChange={(e) => updateRule(i, { movieId: e.target.value })} className="flex-1">
                  {movies?.items.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </Select>
              )}
              {kind === "cinema" && (
                <Select value={rule.cinemaId} onChange={(e) => updateRule(i, { cinemaId: e.target.value })} className="flex-1">
                  {cinemas?.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
              {kind === "day" && (
                <Select
                  value={rule.dayOfWeek}
                  onChange={(e) => updateRule(i, { dayOfWeek: Number(e.target.value) })}
                  className="flex-1"
                >
                  {DAY_LABELS.map((label, d) => (
                    <option key={d} value={d}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}

              <button type="button" onClick={() => removeRule(i)} className="text-ink-muted hover:text-danger">
                <Trash2 className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addRule}>
        <Plus className="size-3.5" /> Agregar regla
      </Button>
    </div>
  );
}
