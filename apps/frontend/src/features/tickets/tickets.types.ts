export interface ValidatedTicket {
  id: string;
  checkedInAt: string;
  user: { firstName: string; lastName: string };
  showtime: {
    startTime: string;
    movie: { title: string; posterUrl: string | null };
    room: { name: string; cinema: { name: string } };
  };
  seats: { showtimeSeat: { seat: { rowLabel: string; seatNumber: number } } }[];
}
