import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  /** Acciones destructivas (cancelar funcion, reembolsar, desactivar) usan el boton carmesi. */
  destructive?: boolean;
  isPending?: boolean;
  onConfirm: () => void;
}

/**
 * Confirmacion previa a toda accion destructiva o dificil de revertir del
 * panel. Radix Dialog maneja foco atrapado, Escape y retorno del foco.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  destructive = false,
  isPending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 border border-hairline bg-surface p-6 focus-visible:outline-none">
          <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-gold to-transparent" />
          <Dialog.Title className="font-display text-xl italic text-ink">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-relaxed text-ink-muted">
            {description}
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="outline" size="sm" disabled={isPending}>
                Volver
              </Button>
            </Dialog.Close>
            <Button
              size="sm"
              variant={destructive ? "crimson" : "default"}
              disabled={isPending}
              onClick={onConfirm}
            >
              {isPending ? "Procesando…" : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
