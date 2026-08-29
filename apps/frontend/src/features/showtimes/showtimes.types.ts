import type { Language, MovieSummary } from "@/features/movies/movies.types";
import type { Room } from "@/features/cinemas/cinemas.types";

export interface Showtime {
  id: string;
  startTime: string;
  endTime: string;
  basePrice: string;
  format: "TWO_D" | "THREE_D";
  status: "SCHEDULED" | "CANCELLED" | "COMPLETED";
  movie: Pick<MovieSummary, "id" | "title" | "posterUrl">;
  room: Room & { cinema: { id: string; name: string; city: string } };
  audioLanguage: Language;
  subtitleLanguage: Language | null;
  availableSeats: number;
}

export interface ListShowtimesParams {
  movieId?: string;
  cinemaId?: string;
  date?: string;
  page?: number;
  pageSize?: number;
}
