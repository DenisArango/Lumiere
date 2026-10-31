import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

/**
 * 404 de verdad (antes era el placeholder de "en construccion"): una pagina que
 * no existe no esta "en construccion". El 404 hace de claqueta de cine.
 */
export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="reel-index text-8xl leading-none text-gold sm:text-9xl">404</p>
      <div className="mt-6 h-px w-24 bg-linear-to-r from-transparent via-gold to-transparent" />
      <h1 className="mt-6 font-display text-3xl italic text-ink">Esta toma no está en el guion</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
        La página que buscas no existe o cambió de lugar. Vuelve a la cartelera y elige tu próxima función.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link to="/">Ver la cartelera</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/cines">Nuestros cines</Link>
        </Button>
      </div>
    </div>
  );
}
