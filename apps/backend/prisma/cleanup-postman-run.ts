/**
 * Borra unicamente los registros creados por docs/api-testing/Lumiere.postman_collection.json
 * en corridas previas de Newman/EchoAPI (identificadores fijos "... de prueba Postman"),
 * para poder re-correr la coleccion completa sin choques de unicidad (409).
 * No toca los datos de prisma/seed.ts ni prisma/seed-demo.ts.
 *
 * Uso: pnpm --filter @lumiere/backend prisma:cleanup-postman
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: "cliente.postman@lumiere.test" } });
  if (user) {
    await prisma.review.deleteMany({ where: { userId: user.id } });
    await prisma.orderItem.deleteMany({ where: { order: { userId: user.id } } });
    await prisma.payment.deleteMany({ where: { order: { userId: user.id } } });
    await prisma.orderSeat.deleteMany({ where: { order: { userId: user.id } } });
    await prisma.order.deleteMany({ where: { userId: user.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    console.log("Usuario cliente.postman@lumiere.test y sus dependencias eliminados");
  }

  const movie = await prisma.movie.findFirst({ where: { title: "Película de prueba Postman" } });
  if (movie) {
    await prisma.review.deleteMany({ where: { movieId: movie.id } });
    await prisma.movieCredit.deleteMany({ where: { movieId: movie.id } });
    await prisma.movieGenre.deleteMany({ where: { movieId: movie.id } });
    const showtimes = await prisma.showtime.findMany({ where: { movieId: movie.id } });
    for (const st of showtimes) {
      await prisma.orderSeat.deleteMany({ where: { order: { showtimeId: st.id } } });
      await prisma.orderItem.deleteMany({ where: { order: { showtimeId: st.id } } });
      await prisma.payment.deleteMany({ where: { order: { showtimeId: st.id } } });
      await prisma.order.deleteMany({ where: { showtimeId: st.id } });
      await prisma.showtimeSeat.deleteMany({ where: { showtimeId: st.id } });
    }
    await prisma.showtime.deleteMany({ where: { movieId: movie.id } });
    await prisma.movie.delete({ where: { id: movie.id } });
    console.log("Película de prueba Postman y sus dependencias eliminadas");
  }

  const genre = await prisma.genre.findFirst({ where: { name: "Género de prueba Postman" } });
  if (genre) {
    await prisma.movieGenre.deleteMany({ where: { genreId: genre.id } });
    await prisma.genre.delete({ where: { id: genre.id } });
    console.log("Género de prueba Postman eliminado");
  }

  const person = await prisma.person.findFirst({ where: { firstName: "Persona", lastName: "De Prueba" } });
  if (person) {
    await prisma.movieCredit.deleteMany({ where: { personId: person.id } });
    await prisma.person.delete({ where: { id: person.id } });
    console.log("Persona De Prueba eliminada");
  }

  const cinema = await prisma.cinema.findFirst({ where: { name: "Cine de prueba Postman" } });
  if (cinema) {
    const rooms = await prisma.room.findMany({ where: { cinemaId: cinema.id } });
    for (const room of rooms) {
      const showtimes = await prisma.showtime.findMany({ where: { roomId: room.id } });
      for (const st of showtimes) {
        await prisma.showtimeSeat.deleteMany({ where: { showtimeId: st.id } });
        await prisma.orderSeat.deleteMany({ where: { order: { showtimeId: st.id } } });
        await prisma.orderItem.deleteMany({ where: { order: { showtimeId: st.id } } });
        await prisma.payment.deleteMany({ where: { order: { showtimeId: st.id } } });
        await prisma.order.deleteMany({ where: { showtimeId: st.id } });
      }
      await prisma.showtime.deleteMany({ where: { roomId: room.id } });
      await prisma.seat.deleteMany({ where: { roomId: room.id } });
    }
    await prisma.room.deleteMany({ where: { cinemaId: cinema.id } });
    await prisma.cinema.delete({ where: { id: cinema.id } });
    console.log("Cine de prueba Postman y sus dependencias eliminados");
  }

  const promo = await prisma.promotion.findFirst({ where: { code: "POSTMAN20" } });
  if (promo) {
    await prisma.promotionRule.deleteMany({ where: { promotionId: promo.id } });
    await prisma.promotion.delete({ where: { id: promo.id } });
    console.log("Promoción POSTMAN20 eliminada");
  }

  const product = await prisma.product.findFirst({ where: { name: "Combo de prueba Postman" } });
  if (product) {
    await prisma.orderItem.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
    console.log("Combo de prueba Postman eliminado");
  }

  console.log("Limpieza completa.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
