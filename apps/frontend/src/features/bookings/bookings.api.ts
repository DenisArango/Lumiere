import { apiClient } from "@/lib/api-client";
import type { LockSeatsResult, Order, SeatMapEntry } from "@/features/bookings/bookings.types";
import type { PaginatedResult } from "@/features/movies/movies.types";

interface OrderWithShowtime extends Order {
  showtime: { movie: { id: string; title: string; posterUrl: string | null } };
}

export async function fetchMyOrders(): Promise<PaginatedResult<OrderWithShowtime>> {
  const { data } = await apiClient.get<PaginatedResult<OrderWithShowtime>>("/orders/me", {
    params: { pageSize: 50 },
  });
  return data;
}

export async function fetchSeatMap(showtimeId: string): Promise<SeatMapEntry[]> {
  const { data } = await apiClient.get<{ seats: SeatMapEntry[] }>(`/showtimes/${showtimeId}/seats`);
  return data.seats;
}

export async function lockSeats(showtimeId: string, seatIds: string[]): Promise<LockSeatsResult> {
  const { data } = await apiClient.post<LockSeatsResult>(`/showtimes/${showtimeId}/seats/lock`, { seatIds });
  return data;
}

export async function releaseSeats(showtimeId: string, seatIds: string[]): Promise<void> {
  await apiClient.post(`/showtimes/${showtimeId}/seats/release`, { seatIds });
}

export async function createOrder(input: {
  showtimeId: string;
  seatIds: string[];
  promotionCode?: string;
  items?: { productId: string; quantity: number }[];
}): Promise<Order> {
  const { data } = await apiClient.post<{ order: Order }>("/orders", input);
  return data.order;
}

export async function cancelOrder(orderId: string): Promise<Order> {
  const { data } = await apiClient.post<{ order: Order }>(`/orders/${orderId}/cancel`);
  return data.order;
}

export async function payOrder(orderId: string, provider: "STRIPE" | "PAYPAL", source: string): Promise<Order> {
  const { data } = await apiClient.post<{ order: Order }>(`/orders/${orderId}/pay`, { provider, source });
  return data.order;
}

export async function fetchOrder(orderId: string): Promise<Order> {
  const { data } = await apiClient.get<{ order: Order }>(`/orders/${orderId}`);
  return data.order;
}
