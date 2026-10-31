import { PrismaClient } from "@prisma/client";
import process from "node:process";

const prisma = new PrismaClient();

// Pósteres de las 8 películas de Harry Potter
const posters: Record<number, string> = {
  2001: "https://image.tmdb.org/t/p/w500/lR4drT4VGfts32j9jYTZUc1a3Pa.jpg",
  2002: "https://image.tmdb.org/t/p/w500/sdEOH0992YZ0QSxgXNIGLq1ToUi.jpg",
  2004: "https://image.tmdb.org/t/p/w500/aWxwnYoe8p2d2fcxOqtvAtJ72Rw.jpg",
  2005: "https://image.tmdb.org/t/p/w500/q2HYM9ysU8ymSmjq40FDFumWanR.jpg",
  2007: "https://image.tmdb.org/t/p/w500/pjQHDhPYfXnTgVvFkCB558NtAaJ.jpg",
  2009: "https://image.tmdb.org/t/p/w500/z7uo9zmQdQwU5ZJHFpv2Upl30i1.jpg",
  2010: "https://image.tmdb.org/t/p/w500/iGoXIpQb7Pot00EEdwpwPajheZ5.jpg",
  2011: "https://image.tmdb.org/t/p/w500/c54HpQmuwXjHq2C9wmoACjxoom3.jpg",
};

// Datos de demostración para Lumière.
// Las clasificaciones son internas del sistema.
const films = [
  [
    "Harry Potter y la piedra filosofal",
    "Harry Potter and the Philosopher's Stone",
    2001,
    152,
    "Harry descubre que es un mago y comienza sus estudios en Hogwarts, donde se enfrenta al misterio de la piedra filosofal.",
  ],
  [
    "Harry Potter y la cámara secreta",
    "Harry Potter and the Chamber of Secrets",
    2002,
    161,
    "Un peligro oculto amenaza a los estudiantes de Hogwarts y Harry investiga los secretos del castillo.",
  ],
  [
    "Harry Potter y el prisionero de Azkaban",
    "Harry Potter and the Prisoner of Azkaban",
    2004,
    142,
    "Harry descubre nuevos detalles sobre su pasado mientras un fugitivo de Azkaban parece acercarse a Hogwarts.",
  ],
  [
    "Harry Potter y el cáliz de fuego",
    "Harry Potter and the Goblet of Fire",
    2005,
    157,
    "Harry participa inesperadamente en el Torneo de los Tres Magos y se enfrenta a pruebas cada vez más peligrosas.",
  ],
  [
    "Harry Potter y la Orden del Fénix",
    "Harry Potter and the Order of the Phoenix",
    2007,
    138,
    "Ante el regreso de Voldemort, Harry y sus amigos organizan un grupo para aprender a defenderse.",
  ],
  [
    "Harry Potter y el misterio del príncipe",
    "Harry Potter and the Half-Blood Prince",
    2009,
    153,
    "Harry y Dumbledore investigan el pasado de Voldemort mientras una amenaza crece dentro de Hogwarts.",
  ],
  [
    "Harry Potter y las reliquias de la Muerte: parte 1",
    "Harry Potter and the Deathly Hallows – Part 1",
    2010,
    146,
    "Harry, Ron y Hermione emprenden una misión para encontrar y destruir los horrocruxes de Voldemort.",
  ],
  [
    "Harry Potter y las reliquias de la Muerte: parte 2",
    "Harry Potter and the Deathly Hallows – Part 2",
    2011,
    130,
    "La búsqueda de los horrocruxes culmina en la batalla decisiva por Hogwarts.",
  ],
] as const;

async function main() {
  console.log("Iniciando carga de Harry Potter en Lumière...");

  const language = await prisma.language.findUnique({
    where: { code: "en" },
  });

  const rating = await prisma.movieRating.findUnique({
    where: { code: "B" },
  });

  const fantasy = await prisma.genre.findUnique({
    where: { name: "Fantasía" },
  });

  const adventure = await prisma.genre.findUnique({
    where: { name: "Aventura" },
  });

  if (!language || !rating || !fantasy || !adventure) {
    throw new Error(
      "Faltan catálogos necesarios: idioma, clasificación o géneros."
    );
  }

  let created = 0;
  let updated = 0;

  for (const [
    title,
    originalTitle,
    releaseYear,
    durationMinutes,
    synopsis,
  ] of films) {
    const posterUrl = posters[releaseYear];

    if (!posterUrl) {
      throw new Error(`Falta el póster para ${title}`);
    }

    const existing = await prisma.movie.findFirst({
      where: { originalTitle },
    });

    // Si ya existe, actualizar únicamente su póster.
    if (existing) {
      await prisma.movie.update({
        where: { id: existing.id },
        data: { posterUrl },
      });

      console.log(`Póster actualizado: ${title}`);
      updated++;
      continue;
    }

    // Si no existe, registrar la película completa.
    await prisma.movie.create({
      data: {
        title,
        originalTitle,
        releaseYear,
        durationMinutes,
        synopsis,
        countryOfOrigin: "Reino Unido / Estados Unidos",
        originalLanguageId: language.id,
        ratingId: rating.id,
        status: "IN_THEATERS",
        posterUrl,
        genres: {
          create: [
            { genreId: fantasy.id },
            { genreId: adventure.id },
          ],
        },
      },
    });

    console.log(`Película creada: ${title}`);
    created++;
  }

  console.log("Carga de Harry Potter finalizada.");
  console.log(`Películas nuevas: ${created}`);
  console.log(`Pósteres actualizados: ${updated}`);
}

main()
  .catch((error) => {
    console.error("Error al cargar las películas:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

