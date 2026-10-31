import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { OrderStatus } from "@/features/bookings/bookings.types";

const STATUS: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "Pendiente de pago", tone: "gold" },
  PAID: { label: "Confirmada", tone: "success" },
  CANCELLED: { label: "Cancelada", tone: "muted" },
  REFUNDED: { label: "Reembolsada", tone: "danger" },
  EXPIRED: { label: "Expirada", tone: "muted" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, tone } = STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
