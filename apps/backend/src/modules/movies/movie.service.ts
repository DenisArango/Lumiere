import type { Movie } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/utils/app-error";
import { paginate, toSkipTake, type PaginatedResult } from "@/utils/pagination";
import type {
  CreateMovieInput,
  ListMoviesQuery,
  UpdateMovieInput,
} from "@/modules/movies/movie.schema";

const listInclude = {
  rating: true,
  originalLanguage: true,
  genres: { include: { genre: true } },
} as const;

const detailInclude = {
  rating: true,
  originalLanguage: true,
  genres: { include: { genre: true } },
  credits: {
    include: { person: true },
    orderBy: { billingOrder: "asc" as const },
  },
} as const;

function shapeMovie<T extends { genres: { genre: unknown }[] }>(movie: T) {
  const { genres, ...rest } = movie;
  return { ...rest, genres: genres.map((g) => g.genre) };
}

export async function listMovies(query: ListMoviesQuery): Promise<PaginatedResult<unknown>> {
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.genreId ? { genres: { some: { genreId: query.genreId } } } : {}),
    ...(query.search
      ? { title: { contains: query.search, mode: "insensitive" as const } }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.movie.findMany({
      where,
      include: listInclude,
      orderBy: { releaseYear: "desc" },
      ...toSkipTake(query),
    }),
    prisma.movie.count({ where }),
  ]);

  return paginate(rows.map(shapeMovie), total, query);
}

export async function getMovieById(id: string) {
  const movie = await prisma.movie.findUnique({ where: { id }, include: detailInclude });
  if (!movie) {
    throw new NotFoundError("Película");
  }

  const { genres, credits, ...rest } = movie;
  return {
    ...rest,
    genres: genres.map((g) => g.genre),
    directors: credits.filter((c) => c.creditRole === "DIRECTOR").map((c) => c.person),
    cast: credits
      .filter((c) => c.creditRole === "ACTOR")
      .map((c) => ({ ...c.person, characterName: c.characterName })),
  };
}

export async function createMovie(input: CreateMovieInput): Promise<Movie> {
  const { genreIds, credits, ...movieData } = input;

  return prisma.movie.create({
    data: {
      ...movieData,
      genres: { create: genreIds.map((genreId) => ({ genreId })) },
      credits: {
        create: credits.map((c) => ({
          personId: c.personId,
          creditRole: c.creditRole,
          characterName: c.characterName,
          billingOrder: c.billingOrder,
        })),
      },
    },
  });
}

export async function updateMovie(id: string, input: UpdateMovieInput): Promise<Movie> {
  const existing = await prisma.movie.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Película");
  }

  const { genreIds, credits, ...movieData } = input;

  return prisma.$transaction(async (tx) => {
    if (genreIds) {
      await tx.movieGenre.deleteMany({ where: { movieId: id } });
      await tx.movieGenre.createMany({ data: genreIds.map((genreId) => ({ movieId: id, genreId })) });
    }

    if (credits) {
      await tx.movieCredit.deleteMany({ where: { movieId: id } });
      await tx.movieCredit.createMany({
        data: credits.map((c) => ({
          movieId: id,
          personId: c.personId,
          creditRole: c.creditRole,
          characterName: c.characterName,
          billingOrder: c.billingOrder,
        })),
      });
    }

    return tx.movie.update({ where: { id }, data: movieData });
  });
}
