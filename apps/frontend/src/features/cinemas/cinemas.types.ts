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

export interface Room {
  id: string;
  name: string;
  roomType: "STANDARD" | "IMAX" | "VIP" | "FOUR_DX" | "DOLBY_ATMOS";
  totalCapacity: number;
}

export interface CinemaDetail extends Cinema {
  rooms: Room[];
}
