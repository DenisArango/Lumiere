import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  /** Accion principal de la pantalla (ej. "Nuevo"). */
  action?: ReactNode;
}

/** Cabecera uniforme de todas las pantallas del panel: etiqueta dorada, titulo en cursiva, una accion. */
export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-5">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-1 font-display text-3xl italic text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-xl text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
