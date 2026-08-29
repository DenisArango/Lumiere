export interface Genre {
  id: string;
  name: string;
}

export interface MovieRating {
  id: string;
  code: string;
  description: string;
  minAge: number;
}

export interface Language {
  id: string;
  name: string;
  code: string;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  bio: string | null;
  photoUrl: string | null;
  nationality: string | null;
  characterName?: string | null;
}

export type MovieStatus = "COMING_SOON" | "IN_THEATERS" | "ARCHIVED";

export interface MovieSummary {
  id: string;
  title: string;
  originalTitle: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  durationMinutes: number;
  releaseYear: number;
  status: MovieStatus;
  rating: MovieRating;
  originalLanguage: Language;
  genres: Genre[];
}

export interface MovieDetail extends MovieSummary {
  synopsis: string;
  countryOfOrigin: string;
  trailerUrl: string | null;
  directors: Person[];
  cast: Person[];
  averageRating: number | null;
  reviewCount: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListMoviesParams {
  page?: number;
  pageSize?: number;
  status?: MovieStatus;
  genreId?: string;
  search?: string;
}

export interface MovieCreditInput {
  personId: string;
  creditRole: "DIRECTOR" | "ACTOR";
  characterName?: string;
  billingOrder?: number;
}

export interface CreateMovieInput {
  title: string;
  originalTitle?: string;
  synopsis: string;
  durationMinutes: number;
  releaseYear: number;
  countryOfOrigin: string;
  posterUrl?: string;
  backdropUrl?: string;
  trailerUrl?: string;
  status: MovieStatus;
  ratingId: string;
  originalLanguageId: string;
  genreIds: string[];
  credits: MovieCreditInput[];
}

export type UpdateMovieInput = Partial<CreateMovieInput>;
