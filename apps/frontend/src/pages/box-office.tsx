import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { CheckCircle2, QrCode, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth/auth.store";
import { validateTicket } from "@/features/tickets/tickets.api";
import type { ValidatedTicket } from "@/features/tickets/tickets.types";
import { getApiErrorMessage } from "@/lib/api-client";

const STAFF_ROLES = new Set(["BOX_OFFICE", "CINEMA_MANAGER", "SUPER_ADMIN"]);

type Result = { kind: "success"; ticket: ValidatedTicket } | { kind: "error"; message: string } | null;

/**
 * Pantalla de taquilla: entrada de codigo optimizada para lector de
 * codigo de barras/QR (que simula tipeo + Enter) tanto como para
 * ingreso manual. Autoenfoca el input despues de cada intento para
 * escaneo continuo sin tocar el mouse - ver docs/backend/10-validacion-boletos.md.
 */
export function BoxOfficePage() {
  const user = useAuthStore((s) => s.user);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Result>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [result]);

  if (isInitializing) return null;
  if (!user || !STAFF_ROLES.has(user.role)) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setIsSubmitting(true);
    try {
      const ticket = await validateTicket(code.trim());
      setResult({ kind: "success", ticket });
    } catch (error) {
      setResult({ kind: "error", message: getApiErrorMessage(error, "Código no válido") });
    } finally {
      setCode("");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <div className="text-center">
        <QrCode className="mx-auto size-8 text-gold" />
        <p className="eyebrow mt-3">Taquilla</p>
        <h1 className="mt-1 font-display text-2xl italic text-ink">Validar boleto</h1>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 flex gap-2">
        <Input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="LMR-XXXXXXXXXXXX"
          autoFocus
          disabled={isSubmitting}
        />
        <Button type="submit" disabled={isSubmitting || !code.trim()}>
          {isSubmitting ? "Validando…" : "Validar"}
        </Button>
      </form>

      {result?.kind === "success" && (
        <div className="mt-8 border border-success p-5 text-center">
          <CheckCircle2 className="mx-auto size-8 text-success" />
          <p className="mt-2 font-display text-lg italic text-ink">{result.ticket.showtime.movie.title}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {result.ticket.showtime.room.cinema.name} · {result.ticket.showtime.room.name}
          </p>
          <p className="text-sm text-ink-muted">
            {new Date(result.ticket.showtime.startTime).toLocaleString("es", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
          <p className="mt-2 text-sm text-ink">
            Butacas: {result.ticket.seats.map((s) => `${s.showtimeSeat.seat.rowLabel}${s.showtimeSeat.seat.seatNumber}`).join(", ")}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {result.ticket.user.firstName} {result.ticket.user.lastName}
          </p>
        </div>
      )}

      {result?.kind === "error" && (
        <div className="mt-8 border border-danger p-5 text-center">
          <XCircle className="mx-auto size-8 text-danger" />
          <p className="mt-2 text-sm text-danger">{result.message}</p>
        </div>
      )}
    </div>
  );
}
