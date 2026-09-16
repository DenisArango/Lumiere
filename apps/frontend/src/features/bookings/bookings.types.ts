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
  createdAt: string;
  showtimeId: string;
  seats: OrderSeat[];
}
