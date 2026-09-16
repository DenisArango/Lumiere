import { z } from "zod";

export const cinemaFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(150),
  address: z.string().trim().min(1, "La dirección es requerida").max(250),
  city: z.string().trim().min(1, "La ciudad es requerida").max(100),
  state: z.string().trim().min(1, "El estado es requerido").max(100),
  country: z.string().trim().min(1, "El país es requerido").max(100),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
});

export type CinemaFormValues = z.infer<typeof cinemaFormSchema>;

export const roomFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre de la sala es requerido").max(50),
  roomType: z.enum(["STANDARD", "IMAX", "VIP", "FOUR_DX", "DOLBY_ATMOS"]),
});

export type RoomFormValues = z.infer<typeof roomFormSchema>;
