import type { Request, Response } from "express";
import * as bookingService from "@/modules/bookings/booking.service";
import type {
  CreateOrderInput,
  LockSeatsInput,
  ReleaseSeatsInput,
} from "@/modules/bookings/booking.schema";
import type { Pagination } from "@/utils/pagination";

const STAFF_ROLES = new Set(["SUPER_ADMIN", "CINEMA_MANAGER", "BOX_OFFICE"]);

export async function lockSeats(req: Request, res: Response): Promise<void> {
  const { seatIds } = req.body as LockSeatsInput;
  const result = await bookingService.lockSeats(req.params.showtimeId as string, seatIds, req.user!.id);
  res.status(200).json(result);
}

export async function releaseSeats(req: Request, res: Response): Promise<void> {
  const { seatIds } = req.body as ReleaseSeatsInput;
  const released = await bookingService.releaseSeats(
    req.params.showtimeId as string,
    seatIds,
    req.user!.id,
  );
  res.status(200).json({ seatIds: released });
}

export async function createOrder(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateOrderInput;
  const order = await bookingService.createOrder(req.user!.id, input);
  res.status(201).json({ order });
}

export async function cancelOrder(req: Request, res: Response): Promise<void> {
  const isStaff = STAFF_ROLES.has(req.user!.role);
  const order = await bookingService.cancelOrder(req.params.id as string, req.user!.id, isStaff);
  res.status(200).json({ order });
}

export async function getOrderById(req: Request, res: Response): Promise<void> {
  const isStaff = STAFF_ROLES.has(req.user!.role);
  const order = await bookingService.getOrderById(req.params.id as string, req.user!.id, isStaff);
  res.status(200).json({ order });
}

export async function listMyOrders(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as Pagination;
  const result = await bookingService.listMyOrders(req.user!.id, query);
  res.status(200).json(result);
}
