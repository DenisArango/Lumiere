import { Logo } from "@/components/layout/logo";

export function Footer() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Logo />
          <p className="max-w-sm text-sm text-ink-muted">
            Donde nació la experiencia de ver historias en pantalla.
          </p>
        </div>
        <p className="text-xs text-ink-muted">
          © {new Date().getFullYear()} Lumière. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
