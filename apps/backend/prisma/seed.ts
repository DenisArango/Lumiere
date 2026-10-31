import { PrismaClient } from "@prisma/client";
import { seedReferenceData } from "../src/bootstrap/reference-data";

const prisma = new PrismaClient();

/**
 * Datos de referencia (catalogos base), no datos de negocio de ejemplo. Se ejecuta con `prisma:seed`.
 * La logica vive en src/bootstrap/reference-data.ts para compartirla con el arranque de produccion.
 */
seedReferenceData(prisma)
  .then(() => {
    // eslint-disable-next-line no-console
    console.log("Seed de datos de referencia completado.");
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
