import { Link } from "react-router-dom";
import { Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Placeholder honesto para rutas del roadmap aun no construidas - evita enlaces rotos sin fingir una funcionalidad que no existe. */
export function WipPage({ title }: { title: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <Clapperboard className="size-10 text-gold" />
      <h1 className="mt-4 font-display text-2xl text-ink">{title}</h1>
      <p className="mt-2 text-sm text-ink-muted">Esta sección está en construcción.</p>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/">Volver a la cartelera</Link>
      </Button>
    </div>
  );
}
