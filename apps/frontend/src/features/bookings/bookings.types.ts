export type ShowtimeSeatStatus = "AVAILABLE" | "LOCKED" | "SOLD";

export interface SeatType {
  id: string;
  name: string;
  priceMultiplier: string;
}

export interface SeatMapEntry {
  id: string;
  rowLabel: string;
  seatNumber: number;
  seatType: SeatType;
  status: ShowtimeSeatStatus;
}

export interface LockSeatsResult {
  seatIds: string[];
  lockExpiresAt: string;
  ttlSeconds: number;
}

export type OrderStatus = "PENDING" | "PAID" | "CANCELLED" | "REFUNDED" | "EXPIRED";

export interface OrderSeat {
  id: string;
  showtimeSeatId: string;
  priceAtPurchase: string;
}

export interface Order {
  id: string;
  status: OrderStatus;
  subtotal: string;
  discountAmount: string;
  totalAmount: string;
  qrCode: string | null;
  pointsEarned?: number;
  pointsRedeemed?: number;
  createdAt: string;
  showtimeId: string;
  seats: OrderSeat[];
}

export interface AdminOrder extends Order {
  pointsEarned: number;
  user: { id: string; firstName: string; lastName: string; email: string };
  showtime: { startTime: string; movie: { id: string; title: string; posterUrl: string | null } };
  payment: { provider: "STRIPE" | "PAYPAL"; status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" } | null;
}

export interface ListAllOrdersParams {
  page?: number;
  pageSize?: number;
  status?: OrderStatus;
}
