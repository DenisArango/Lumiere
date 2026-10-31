import { useLocation, Navigate, Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Order } from "@/features/bookings/bookings.types";
import { formatMoney, formatNumber } from "@/lib/format";

export function ConfirmationPage() {
  const location = useLocation();
  const order = (location.state as { order?: Order } | null)?.order;

  if (!order) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
      <CheckCircle2 className="mx-auto size-10 text-success" />
      <p className="eyebrow mt-4">Compra confirmada</p>
      <h1 className="mt-1 font-display text-3xl italic text-ink">Disfruta tu función</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Presenta este código en la entrada de la sala. También lo encuentras siempre en “Mis boletos”.
      </p>

      <div className="mx-auto mt-8 max-w-xs border border-dashed border-hairline bg-surface p-6">
        <div className="flex justify-center bg-white p-3">
          <QRCodeSVG value={order.qrCode ?? order.id} size={160} />
        </div>
        <p className="reel-index mt-4 text-lg">{order.qrCode}</p>
        <p className="mt-1 text-xs text-ink-muted">Total pagado: {formatMoney(order.totalAmount)}</p>
      </div>

      {order.pointsEarned ? (
        <p className="mx-auto mt-6 max-w-xs border border-gold/50 px-4 py-3 text-sm text-gold">
          Sumaste <strong>{formatNumber(order.pointsEarned)} puntos</strong> en Lumière.
        </p>
      ) : null}

      <Button asChild variant="outline" className="mt-8">
        <Link to="/mis-ordenes">Ver mis boletos</Link>
      </Button>
    </div>
  );
}
