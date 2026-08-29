import type { Person } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/utils/app-error";
import { paginate, toSkipTake, type PaginatedResult } from "@/utils/pagination";
import type {
  CreatePersonInput,
  ListPeopleQuery,
  UpdatePersonInput,
} from "@/modules/people/person.schema";

export async function listPeople(query: ListPeopleQuery): Promise<PaginatedResult<Person>> {
  const where = query.search
    ? {
        OR: [
          { firstName: { contains: query.search, mode: "insensitive" as const } },
          { lastName: { contains: query.search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.person.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      ...toSkipTake(query),
    }),
    prisma.person.count({ where }),
  ]);

  return paginate(items, total, query);
}

/**
 * "Cantidad de peliculas en las que participa" (RF-02) se calcula aqui,
 * nunca se almacena como columna - ver docs/04-modelo-datos.md seccion 3.
 */
export async function getPersonById(id: string) {
  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      credits: {
        include: {
          movie: {
            select: { id: true, title: true, posterUrl: true, releaseYear: true, status: true },
          },
        },
        orderBy: { movie: { releaseYear: "desc" } },
      },
    },
  });

  if (!person) {
    throw new NotFoundError("Persona");
  }

  const { credits, ...personData } = person;

  const filmographyAsDirector = credits
    .filter((c) => c.creditRole === "DIRECTOR")
    .map((c) => c.movie);
  const filmographyAsActor = credits
    .filter((c) => c.creditRole === "ACTOR")
    .map((c) => ({ ...c.movie, characterName: c.characterName }));

  return {
    ...personData,
    movieCounts: {
      asDirector: filmographyAsDirector.length,
      asActor: filmographyAsActor.length,
    },
    filmography: {
      asDirector: filmographyAsDirector,
      asActor: filmographyAsActor,
    },
  };
}

export async function createPerson(input: CreatePersonInput): Promise<Person> {
  return prisma.person.create({ data: input });
}

export async function updatePerson(id: string, input: UpdatePersonInput): Promise<Person> {
  const existing = await prisma.person.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Persona");
  }
  return prisma.person.update({ where: { id }, data: input });
}
