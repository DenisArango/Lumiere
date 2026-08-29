export interface Cinema {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string | null;
  isActive: boolean;
}

export type RoomType = "STANDARD" | "IMAX" | "VIP" | "FOUR_DX" | "DOLBY_ATMOS";

export interface Room {
  id: string;
  name: string;
  roomType: RoomType;
  totalCapacity: number;
}

export interface CinemaDetail extends Cinema {
  rooms: Room[];
}

export interface CreateCinemaInput {
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone?: string;
}

export interface RoomRowInput {
  rowLabel: string;
  seatCount: number;
  seatTypeId: string;
}

export interface CreateRoomInput {
  name: string;
  roomType: RoomType;
  rows: RoomRowInput[];
}
