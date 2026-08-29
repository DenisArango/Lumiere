import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Datos de referencia (catalogos base), no datos de negocio de ejemplo.
 * Se ejecuta con `npm run prisma:seed`. Cada modulo futuro que necesite
 * datos de demostracion (peliculas, cines, funciones) agrega su propio
 * seed incremental documentado en su docs/backend/<modulo>.md.
 */
async function main(): Promise<void> {
  await prisma.language.createMany({
    data: [
      { name: "Español", code: "es" },
      { name: "Inglés", code: "en" },
      { name: "Francés", code: "fr" },
      { name: "Japonés", code: "ja" },
      { name: "Coreano", code: "ko" },
    ],
    skipDuplicates: true,
  });

  await prisma.movieRating.createMany({
    data: [
      { code: "A", description: "Apta para todo público", minAge: 0 },
      { code: "B", description: "Apta para adolescentes y adultos", minAge: 12 },
      { code: "B15", description: "Apta para adolescentes de 15 años en adelante", minAge: 15 },
      { code: "C", description: "Apta solo para adultos", minAge: 18 },
    ],
    skipDuplicates: true,
  });

  await prisma.genre.createMany({
    data: [
      { name: "Acción" },
      { name: "Aventura" },
      { name: "Animación" },
      { name: "Comedia" },
      { name: "Drama" },
      { name: "Terror" },
      { name: "Ciencia ficción" },
      { name: "Suspenso" },
      { name: "Romance" },
      { name: "Documental" },
      { name: "Fantasía" },
      { name: "Familiar" },
    ],
    skipDuplicates: true,
  });

  await prisma.seatType.createMany({
    data: [
      { name: "Estándar", priceMultiplier: 1.0 },
      { name: "VIP", priceMultiplier: 1.5 },
      { name: "Reclinable", priceMultiplier: 1.8 },
      { name: "Silla de ruedas", priceMultiplier: 1.0 },
    ],
    skipDuplicates: true,
  });

  // eslint-disable-next-line no-console
  console.log("Seed de datos de referencia completado.");
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
