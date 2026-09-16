import { MapPin, Phone } from "lucide-react";
import { useCinemas } from "@/features/cinemas/cinemas.hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CinemasPage() {
  const { data, isLoading, isError } = useCinemas();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Ubicaciones</p>
      <h1 className="mt-1 font-display text-3xl italic text-ink">Nuestros cines</h1>
      <p className="mt-1 text-sm text-ink-muted">Encuentra la sala más cercana a ti.</p>

      {isLoading && <p className="mt-8 text-ink-muted">Cargando…</p>}
      {isError && <p className="mt-8 text-danger">No pudimos cargar los cines.</p>}

      {data && data.items.length === 0 && (
        <p className="mt-8 text-ink-muted">Todavía no hay cines registrados.</p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {data?.items.map((cinema) => (
          <Card key={cinema.id}>
            <CardHeader>
              <CardTitle>{cinema.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-ink-muted">
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                {cinema.address}, {cinema.city}, {cinema.state}
              </p>
              {cinema.phone && (
                <p className="flex items-center gap-2">
                  <Phone className="size-4 shrink-0" /> {cinema.phone}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
