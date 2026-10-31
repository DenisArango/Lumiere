export interface PersonSummary {
  id: string;
  firstName: string;
  lastName: string;
}

export interface CreatePersonInput {
  firstName: string;
  lastName: string;
}

/** Fila del listado del panel: incluye los datos editables de la persona. */
export interface Person extends PersonSummary {
  bio: string | null;
  photoUrl: string | null;
  birthDate: string | null;
  nationality: string | null;
}

export interface UpdatePersonInput {
  firstName?: string;
  lastName?: string;
  bio?: string;
  photoUrl?: string;
  nationality?: string;
}

export interface FilmographyMovie {
  id: string;
  title: string;
  posterUrl: string | null;
  releaseYear: number;
  status: "COMING_SOON" | "IN_THEATERS" | "ARCHIVED";
}

/** Detalle publico (GET /people/:id): "cantidad de peliculas" (RF-02) viene calculada por el backend. */
export interface PersonDetail extends Person {
  movieCounts: { asDirector: number; asActor: number };
  filmography: {
    asDirector: FilmographyMovie[];
    asActor: (FilmographyMovie & { characterName: string | null })[];
  };
}
