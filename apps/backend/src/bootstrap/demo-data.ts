import argon2 from "argon2";
import type { PrismaClient, Role } from "@prisma/client";

/**
 * Datos de DEMOSTRACION completos para presentar el sistema: cines y salas, peliculas con poster, funciones de los
 * proximos 7 dias, dulceria, promociones, cuentas por rol, compras pagadas del ultimo mes y resenas verificadas
 * (para que el dashboard de reportes tenga datos reales que mostrar).
 *
 * Idempotente: cada bloque busca antes de crear, asi que se puede ejecutar en cada arranque. Las FUNCIONES se
 * renuevan (siempre quedan los proximos 7 dias), porque el sitio oculta las que ya comenzaron. Se activa con
 * SEED_DEMO_DATA=true (ver bootstrap/run.ts). Las cuentas demo usan contrasenas conocidas: solo para demostraciones.
 */

const POSTERS: Record<number, string> = {
  2001: "https://image.tmdb.org/t/p/w500/lR4drT4VGfts32j9jYTZUc1a3Pa.jpg",
  2002: "https://image.tmdb.org/t/p/w500/sdEOH0992YZ0QSxgXNIGLq1ToUi.jpg",
  2004: "https://image.tmdb.org/t/p/w500/aWxwnYoe8p2d2fcxOqtvAtJ72Rw.jpg",
  2005: "https://image.tmdb.org/t/p/w500/q2HYM9ysU8ymSmjq40FDFumWanR.jpg",
  2007: "https://image.tmdb.org/t/p/w500/pjQHDhPYfXnTgVvFkCB558NtAaJ.jpg",
  2009: "https://image.tmdb.org/t/p/w500/z7uo9zmQdQwU5ZJHFpv2Upl30i1.jpg",
  2010: "https://image.tmdb.org/t/p/w500/iGoXIpQb7Pot00EEdwpwPajheZ5.jpg",
  2011: "https://image.tmdb.org/t/p/w500/c54HpQmuwXjHq2C9wmoACjxoom3.jpg",
};

// [titulo, año, minutos, clasificacion, sinopsis, en cartelera?]
const MOVIES: [string, number, number, string, string, boolean][] = [
  ["Harry Potter y la piedra filosofal", 2001, 152, "A", "Un niño descubre que es mago y entra a Hogwarts, donde un misterio guarda la piedra filosofal.", true],
  ["Harry Potter y la cámara secreta", 2002, 161, "A", "Una antigua cámara vuelve a abrirse en Hogwarts y alguien petrifica a los estudiantes.", true],
  ["Harry Potter y el prisionero de Azkaban", 2004, 142, "B", "Un peligroso prisionero escapa de Azkaban y todo apunta a que va tras Harry.", true],
  ["Harry Potter y el cáliz de fuego", 2005, 157, "B", "Harry es elegido, sin quererlo, para el Torneo de los Tres Magos.", true],
  ["Harry Potter y la Orden del Fénix", 2007, 138, "B", "El Ministerio niega el regreso de Voldemort y Harry forma un ejército secreto.", true],
  ["Harry Potter y el misterio del príncipe", 2009, 153, "B", "Dumbledore guía a Harry hacia los recuerdos que revelan el pasado de Voldemort.", true],
  ["Harry Potter y las reliquias de la Muerte: parte 1", 2010, 146, "B15", "Sin Hogwarts, Harry, Ron y Hermione buscan los horrocruxes que quedan.", false],
  ["Harry Potter y las reliquias de la Muerte: parte 2", 2011, 130, "B15", "La batalla final por Hogwarts decide el destino del mundo mágico.", false],
];

interface MovieSeed {
  title: string;
  year: number;
  minutes: number;
  rating: string;
  synopsis: string;
  showing: boolean;
  genres: string[];
  director: string;
  actors: string[];
  poster: string;
  country: string;
}

// Posters: imagenes oficiales alojadas en Wikimedia (URLs verificadas con 200 OK al preparar la demo).
const EXTRA_MOVIES: MovieSeed[] = [
  { title: "Origen", year: 2010, minutes: 148, rating: "B", synopsis: "Un ladrón que roba secretos entrando en los sueños recibe la misión inversa: implantar una idea.", showing: true, genres: ["Ciencia ficción", "Acción", "Suspenso"], director: "Christopher Nolan", actors: ["Leonardo DiCaprio", "Elliot Page", "Tom Hardy"], poster: "https://upload.wikimedia.org/wikipedia/en/2/2e/Inception_%282010%29_theatrical_poster.jpg", country: "Estados Unidos" },
  { title: "El caballero de la noche", year: 2008, minutes: 152, rating: "B15", synopsis: "Batman enfrenta al Joker, un criminal que quiere hundir Gotham en el caos.", showing: true, genres: ["Acción", "Suspenso", "Drama"], director: "Christopher Nolan", actors: ["Christian Bale", "Heath Ledger", "Aaron Eckhart"], poster: "https://upload.wikimedia.org/wikipedia/en/1/1c/The_Dark_Knight_%282008_film%29.jpg", country: "Estados Unidos" },
  { title: "Interestelar", year: 2014, minutes: 169, rating: "B", synopsis: "Un grupo de astronautas cruza un agujero de gusano en busca de un nuevo hogar para la humanidad.", showing: true, genres: ["Ciencia ficción", "Aventura", "Drama"], director: "Christopher Nolan", actors: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain"], poster: "https://upload.wikimedia.org/wikipedia/en/b/bc/Interstellar_film_poster.jpg", country: "Estados Unidos" },
  { title: "Coco", year: 2017, minutes: 105, rating: "A", synopsis: "Miguel viaja a la Tierra de los Muertos para descubrir la historia de su familia y su amor por la música.", showing: true, genres: ["Animación", "Familiar", "Aventura"], director: "Lee Unkrich", actors: ["Anthony Gonzalez", "Gael García Bernal", "Benjamin Bratt"], poster: "https://upload.wikimedia.org/wikipedia/en/9/98/Coco_%282017_film%29_poster.jpg", country: "Estados Unidos" },
  { title: "Toy Story", year: 1995, minutes: 81, rating: "A", synopsis: "Los juguetes de Andy cobran vida cuando nadie los ve, y la llegada de un astronauta lo cambia todo.", showing: true, genres: ["Animación", "Familiar", "Comedia"], director: "John Lasseter", actors: ["Tom Hanks", "Tim Allen"], poster: "https://upload.wikimedia.org/wikipedia/en/1/13/Toy_Story.jpg", country: "Estados Unidos" },
  { title: "El rey león", year: 1994, minutes: 88, rating: "A", synopsis: "Un joven león huye tras la muerte de su padre y debe volver a reclamar su lugar.", showing: true, genres: ["Animación", "Familiar", "Drama"], director: "Roger Allers", actors: ["Matthew Broderick", "Jeremy Irons"], poster: "https://upload.wikimedia.org/wikipedia/en/3/3d/The_Lion_King_poster.jpg", country: "Estados Unidos" },
  { title: "Parque Jurásico", year: 1993, minutes: 127, rating: "B", synopsis: "Un parque con dinosaurios clonados se convierte en una trampa cuando falla la seguridad.", showing: true, genres: ["Aventura", "Ciencia ficción", "Suspenso"], director: "Steven Spielberg", actors: ["Sam Neill", "Laura Dern", "Jeff Goldblum"], poster: "https://upload.wikimedia.org/wikipedia/en/e/e7/Jurassic_Park_poster.jpg", country: "Estados Unidos" },
  { title: "Matrix", year: 1999, minutes: 136, rating: "B15", synopsis: "Un programador descubre que su realidad es una simulación y se une a la rebelión.", showing: true, genres: ["Ciencia ficción", "Acción"], director: "Lana Wachowski", actors: ["Keanu Reeves", "Carrie-Anne Moss", "Laurence Fishburne"], poster: "https://upload.wikimedia.org/wikipedia/en/d/db/The_Matrix.png", country: "Estados Unidos" },
  { title: "Avatar", year: 2009, minutes: 162, rating: "B", synopsis: "Un exmarine se infiltra en el mundo de Pandora y termina dividido entre dos pueblos.", showing: true, genres: ["Ciencia ficción", "Aventura", "Acción"], director: "James Cameron", actors: ["Sam Worthington", "Zoe Saldaña", "Sigourney Weaver"], poster: "https://upload.wikimedia.org/wikipedia/en/d/d6/Avatar_%282009_film%29_poster.jpg", country: "Estados Unidos" },
  { title: "Frozen: el reino del hielo", year: 2013, minutes: 102, rating: "A", synopsis: "Anna emprende un viaje para encontrar a su hermana Elsa y detener un invierno eterno.", showing: true, genres: ["Animación", "Familiar", "Aventura"], director: "Chris Buck", actors: ["Kristen Bell", "Idina Menzel"], poster: "https://upload.wikimedia.org/wikipedia/en/0/05/Frozen_%282013_film%29_poster.jpg", country: "Estados Unidos" },
  { title: "Buscando a Nemo", year: 2003, minutes: 100, rating: "A", synopsis: "Un pez payaso cruza el océano para rescatar a su hijo.", showing: true, genres: ["Animación", "Familiar", "Aventura"], director: "Andrew Stanton", actors: ["Albert Brooks", "Ellen DeGeneres"], poster: "https://upload.wikimedia.org/wikipedia/en/2/29/Finding_Nemo.jpg", country: "Estados Unidos" },
  { title: "Parásitos", year: 2019, minutes: 132, rating: "C", synopsis: "Una familia pobre se infiltra poco a poco en la vida de una familia rica.", showing: true, genres: ["Drama", "Suspenso", "Comedia"], director: "Bong Joon-ho", actors: ["Song Kang-ho", "Choi Woo-shik"], poster: "https://upload.wikimedia.org/wikipedia/en/5/53/Parasite_%282019_film%29.png", country: "Corea del Sur" },
  { title: "Gladiador", year: 2000, minutes: 155, rating: "B15", synopsis: "Un general romano traicionado se convierte en gladiador para vengar a su familia.", showing: true, genres: ["Acción", "Drama", "Aventura"], director: "Ridley Scott", actors: ["Russell Crowe", "Joaquin Phoenix"], poster: "https://upload.wikimedia.org/wikipedia/en/f/fb/Gladiator_%282000_film_poster%29.png", country: "Estados Unidos" },
  { title: "Top Gun: Maverick", year: 2022, minutes: 130, rating: "B", synopsis: "Tras treinta años de servicio, Maverick entrena a una nueva generación para una misión imposible.", showing: true, genres: ["Acción", "Drama"], director: "Joseph Kosinski", actors: ["Tom Cruise", "Miles Teller"], poster: "https://upload.wikimedia.org/wikipedia/en/1/13/Top_Gun_Maverick_Poster.jpg", country: "Estados Unidos" },
  { title: "Intensa-Mente", year: 2015, minutes: 95, rating: "A", synopsis: "Las emociones de una niña, Alegría y Tristeza entre ellas, se pierden fuera de la central.", showing: true, genres: ["Animación", "Familiar", "Comedia"], director: "Pete Docter", actors: ["Amy Poehler", "Phyllis Smith"], poster: "https://upload.wikimedia.org/wikipedia/en/0/0a/Inside_Out_%282015_film%29_poster.jpg", country: "Estados Unidos" },
  { title: "Shrek", year: 2001, minutes: 90, rating: "A", synopsis: "Un ogro gruñón rescata a una princesa para recuperar su pantano.", showing: true, genres: ["Animación", "Comedia", "Familiar"], director: "Andrew Adamson", actors: ["Mike Myers", "Eddie Murphy", "Cameron Diaz"], poster: "https://upload.wikimedia.org/wikipedia/en/7/7b/Shrek_%282001_animated_feature_film%29.jpg", country: "Estados Unidos" },
  { title: "Duna", year: 2021, minutes: 155, rating: "B", synopsis: "Paul Atreides viaja al planeta más peligroso del universo para proteger a su familia.", showing: false, genres: ["Ciencia ficción", "Aventura", "Drama"], director: "Denis Villeneuve", actors: ["Timothée Chalamet", "Zendaya"], poster: "https://upload.wikimedia.org/wikipedia/en/8/8e/Dune_%282021_film%29.jpg", country: "Estados Unidos" },
  { title: "Spider-Man: Un nuevo universo", year: 2018, minutes: 117, rating: "A", synopsis: "Miles Morales descubre que no es el único Spider-Man del multiverso.", showing: false, genres: ["Animación", "Acción", "Aventura"], director: "Bob Persichetti", actors: ["Shameik Moore", "Hailee Steinfeld"], poster: "https://upload.wikimedia.org/wikipedia/en/f/fa/Spider-Man_Into_the_Spider-Verse_poster.png", country: "Estados Unidos" },
];

const MOVIE_SEEDS: MovieSeed[] = [
  ...MOVIES.map(([title, year, minutes, rating, synopsis, showing]): MovieSeed => ({
    title, year, minutes, rating, synopsis, showing,
    genres: ["Fantasía", "Aventura", "Familiar"],
    director: "Chris Columbus",
    actors: ["Daniel Radcliffe", "Emma Watson", "Rupert Grint"],
    poster: POSTERS[year]!,
    country: "Reino Unido",
  })),
  ...EXTRA_MOVIES,
];

const ROOMS = [
  { cinema: "Lumière Reforma", name: "Sala 1", type: "STANDARD" as const, rows: ["A", "B", "C", "D", "E"], seats: 8, vipRows: ["E"], price: 45 },
  { cinema: "Lumière Reforma", name: "Sala IMAX", type: "IMAX" as const, rows: ["A", "B", "C", "D", "E", "F"], seats: 10, vipRows: ["F"], price: 65 },
  { cinema: "Lumière Reforma", name: "Sala VIP", type: "VIP" as const, rows: ["A", "B", "C"], seats: 6, vipRows: ["A", "B", "C"], price: 85, recliner: true },
  { cinema: "Lumière Plaza Norte", name: "Sala A", type: "STANDARD" as const, rows: ["A", "B", "C", "D"], seats: 8, vipRows: [], price: 45 },
  { cinema: "Lumière Plaza Norte", name: "Sala B", type: "DOLBY_ATMOS" as const, rows: ["A", "B", "C", "D"], seats: 8, vipRows: ["D"], price: 55 },
];

const CINEMAS = [
  { name: "Lumière Reforma", address: "Av. Reforma 12-34, Zona 10", city: "Ciudad de Guatemala", phone: "22501000" },
  { name: "Lumière Plaza Norte", address: "Calzada Roosevelt 8-90, Zona 11", city: "Ciudad de Guatemala", phone: "22502000" },
];

const COMMENTS = [
  "Una función espectacular, la sala VIP vale cada quetzal.",
  "Compré los boletos en un minuto y elegí mi butaca. Muy cómodo.",
  "La proyección y el sonido, impecables. Volveré.",
  "Buena película y el combo de palomitas, enorme.",
  "Lo mejor de la saga en pantalla grande.",
  "Muy buena experiencia, la entrada con QR fue rapidísima.",
  "La historia me atrapó de principio a fin. Totalmente recomendada.",
  "Fui con mi familia y todos salimos felices. Gran sala.",
  "Imagen y sonido de primera, la sala IMAX es otra cosa.",
];

const SLOT_HOURS = [14, 17.5, 21]; // hora local de Guatemala; separadas 3.5 h para la funcion mas larga + limpieza
const GT_OFFSET_HOURS = 6; // Guatemala es UTC-6 todo el año

function atLocal(dayOffset: number, hour: number): Date {
  const now = new Date();
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset, h + GT_OFFSET_HOURS, m));
}

export async function seedDemoData(prisma: PrismaClient): Promise<void> {
  const password = process.env.DEMO_PASSWORD ?? "Lumiere2026!";
  const passwordHash = await argon2.hash(password);

  // ---- cuentas por rol
  const accounts: { email: string; first: string; last: string; role: Role; member?: boolean; points?: number }[] = [
    { email: "admin@lumiere.test", first: "Admin", last: "Demo", role: "SUPER_ADMIN" },
    { email: "gerente@lumiere.test", first: "Gerente", last: "Demo", role: "CINEMA_MANAGER" },
    { email: "taquilla@lumiere.test", first: "Taquilla", last: "Demo", role: "BOX_OFFICE" },
    { email: "cliente@lumiere.test", first: "Cliente", last: "Demo", role: "CUSTOMER", member: true, points: 350 },
    { email: "ana@lumiere.test", first: "Ana", last: "Morales", role: "CUSTOMER", member: true, points: 120 },
    { email: "luis@lumiere.test", first: "Luis", last: "Pérez", role: "CUSTOMER" },
    { email: "sofia@lumiere.test", first: "Sofía", last: "Ramírez", role: "CUSTOMER" },
  ];
  const users: Record<string, string> = {};
  for (const a of accounts) {
    const existing = await prisma.user.findUnique({ where: { email: a.email } });
    const user =
      existing ??
      (await prisma.user.create({
        data: {
          email: a.email,
          passwordHash,
          firstName: a.first,
          lastName: a.last,
          role: a.role,
          loyaltyMember: a.member ?? false,
          loyaltyPoints: a.points ?? 0,
          emailVerifiedAt: new Date(),
        },
      }));
    users[a.email] = user.id;
  }

  // ---- peliculas (con poster, director y reparto)
  const language = await prisma.language.findFirstOrThrow({ where: { code: "es" } });
  const allGenres = await prisma.genre.findMany();
  const people = new Map<string, string>();
  const person = async (fullName: string, nationality?: string): Promise<string> => {
    const cached = people.get(fullName);
    if (cached) return cached;
    const [firstName, ...rest] = fullName.split(" ");
    const lastName = rest.join(" ") || "-";
    const row =
      (await prisma.person.findFirst({ where: { firstName: firstName!, lastName } })) ??
      (await prisma.person.create({ data: { firstName: firstName!, lastName, nationality } }));
    people.set(fullName, row.id);
    return row.id;
  };
  const movieIds: { id: string; minutes: number; title: string; showing: boolean }[] = [];
  for (const seed of MOVIE_SEEDS) {
    const rating = await prisma.movieRating.findFirstOrThrow({ where: { code: seed.rating } });
    const existing = await prisma.movie.findFirst({ where: { title: seed.title } });
    let movie = existing;
    if (!movie) {
      const directorId = await person(seed.director);
      const actorIds = await Promise.all(seed.actors.map((a) => person(a)));
      movie = await prisma.movie.create({
        data: {
          title: seed.title,
          synopsis: seed.synopsis,
          durationMinutes: seed.minutes,
          releaseYear: seed.year,
          countryOfOrigin: seed.country,
          posterUrl: seed.poster,
          status: seed.showing ? "IN_THEATERS" : "COMING_SOON",
          ratingId: rating.id,
          originalLanguageId: language.id,
          genres: { create: allGenres.filter((g) => seed.genres.includes(g.name)).map((g) => ({ genreId: g.id })) },
          credits: {
            create: [
              { personId: directorId, creditRole: "DIRECTOR" as const },
              ...actorIds.map((personId) => ({ personId, creditRole: "ACTOR" as const })),
            ],
          },
        },
      });
    } else if (movie.posterUrl !== seed.poster) {
      // Bases que ya tenian la pelicula sin poster (o con otro): se actualiza.
      movie = await prisma.movie.update({ where: { id: movie.id }, data: { posterUrl: seed.poster } });
    }
    movieIds.push({ id: movie.id, minutes: seed.minutes, title: seed.title, showing: seed.showing });
  }
  const showing = movieIds.filter((m) => m.showing);

  // ---- cines, salas y butacas
  const seatTypes = await prisma.seatType.findMany();
  const type = (n: string) => seatTypes.find((t) => t.name === n)!.id;
  const cinemaIds: Record<string, string> = {};
  for (const c of CINEMAS) {
    const existing = await prisma.cinema.findFirst({ where: { name: c.name } });
    cinemaIds[c.name] =
      existing?.id ?? (await prisma.cinema.create({ data: { ...c, state: "Guatemala", country: "Guatemala" } })).id;
  }
  const rooms: { id: string; price: number }[] = [];
  for (const r of ROOMS) {
    let room = await prisma.room.findFirst({ where: { cinemaId: cinemaIds[r.cinema]!, name: r.name } });
    if (!room) {
      room = await prisma.room.create({
        data: { cinemaId: cinemaIds[r.cinema]!, name: r.name, roomType: r.type, totalCapacity: r.rows.length * r.seats },
      });
      await prisma.seat.createMany({
        data: r.rows.flatMap((row) =>
          Array.from({ length: r.seats }, (_, i) => ({
            roomId: room!.id,
            rowLabel: row,
            seatNumber: i + 1,
            seatTypeId: r.recliner ? type("Reclinable") : r.vipRows.includes(row) ? type("VIP") : type("Estándar"),
          })),
        ),
      });
    }
    rooms.push({ id: room.id, price: r.price });
  }

  // ---- funciones: siempre los proximos 7 dias (las pasadas se ocultan solas)
  let rotation = 0;
  for (let day = 1; day <= 7; day += 1) {
    for (const [roomIdx, room] of rooms.entries()) {
      for (const [slotIdx, hour] of SLOT_HOURS.entries()) {
        const movie = showing[rotation++ % showing.length]!; // reparto parejo: todas las peliculas en cartelera tienen funciones
        const startTime = atLocal(day, hour);
        const exists = await prisma.showtime.findFirst({ where: { roomId: room.id, startTime } });
        if (exists) continue;
        const showtime = await prisma.showtime.create({
          data: {
            movieId: movie.id,
            roomId: room.id,
            audioLanguageId: language.id,
            startTime,
            endTime: new Date(startTime.getTime() + (movie.minutes + 20) * 60_000),
            basePrice: room.price,
            format: "TWO_D",
          },
        });
        const seats = await prisma.seat.findMany({ where: { roomId: room.id }, select: { id: true } });
        await prisma.showtimeSeat.createMany({ data: seats.map((s) => ({ showtimeId: showtime.id, seatId: s.id })) });
      }
    }
  }

  // ---- dulceria
  const productData = [
    { name: "Combo Lumière", description: "Palomitas grandes + 2 refrescos", price: 55 },
    { name: "Combo pareja", description: "Palomitas medianas + 2 refrescos + nachos", price: 70 },
    { name: "Refresco grande", description: "Refresco de 32 oz", price: 18 },
    { name: "Nachos con queso", description: "Nachos con salsa de queso", price: 25 },
  ];
  const products: { id: string; price: number }[] = [];
  for (const p of productData) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    const row = existing ?? (await prisma.product.create({ data: p }));
    products.push({ id: row.id, price: Number(row.price) });
  }

  // ---- promociones
  const promos = [
    { code: "BIENVENIDA", name: "Bienvenida Lumière", description: "15% de descuento en tu compra", discountType: "PERCENTAGE" as const, discountValue: 15, rules: [] as { dayOfWeek: number }[] },
    { code: "MARTES20", name: "Martes de cine", description: "20% de descuento todos los martes", discountType: "PERCENTAGE" as const, discountValue: 20, rules: [{ dayOfWeek: 2 }] },
    { code: "FAMILIA10", name: "Día en familia", description: "Q10 de descuento", discountType: "FIXED" as const, discountValue: 10, rules: [] },
  ];
  for (const p of promos) {
    if (await prisma.promotion.findUnique({ where: { code: p.code } })) continue;
    await prisma.promotion.create({
      data: {
        code: p.code,
        name: p.name,
        description: p.description,
        discountType: p.discountType,
        discountValue: p.discountValue,
        startDate: new Date(Date.now() - 24 * 3600 * 1000),
        endDate: new Date(Date.now() + 90 * 24 * 3600 * 1000),
        rules: { create: p.rules },
      },
    });
  }

  // ---- compras pagadas del ultimo mes (alimentan reportes y reseñas verificadas)
  if ((await prisma.order.count({ where: { qrCode: { startsWith: "LMR-DEMOR" } } })) === 0) {
    const buyers = ["cliente@lumiere.test", "ana@lumiere.test", "luis@lumiere.test", "sofia@lumiere.test"];
    const upcoming = await prisma.showtime.findMany({
      where: { startTime: { gt: new Date() }, movieId: { in: showing.map((m) => m.id) } },
      orderBy: { startTime: "asc" },
      take: 100,
    });
    const reviewed = new Set<string>();
    for (let i = 0; i < 90; i += 1) {
      const showtime = upcoming[(i * 7) % upcoming.length]!;
      const wanted = 1 + (i % 3);
      const free = await prisma.showtimeSeat.findMany({
        where: { showtimeId: showtime.id, status: "AVAILABLE" },
        include: { seat: { include: { seatType: true } } },
        take: wanted,
      });
      if (free.length === 0) continue;
      const seatLines = free.map((s) => ({ showtimeSeatId: s.id, priceAtPurchase: Number(showtime.basePrice) * Number(s.seat.seatType.priceMultiplier) }));
      const product = products[i % products.length]!;
      const withItem = i % 2 === 0;
      const subtotal = seatLines.reduce((sum, l) => sum + l.priceAtPurchase, 0) + (withItem ? product.price : 0);
      const buyerEmail = buyers[i % buyers.length]!;
      const buyerId = users[buyerEmail]!;
      const isMember = buyerEmail === "cliente@lumiere.test" || buyerEmail === "ana@lumiere.test";
      const createdAt = new Date(Date.now() - ((i * 5) % 28) * 24 * 3600 * 1000 - (i % 9) * 3600 * 1000);
      const order = await prisma.order.create({
        data: {
          userId: buyerId,
          showtimeId: showtime.id,
          status: "PAID",
          subtotal,
          discountAmount: 0,
          totalAmount: subtotal,
          qrCode: `LMR-DEMOR${String(i).padStart(4, "0")}`,
          pointsEarned: isMember ? Math.floor(subtotal) : 0,
          createdAt,
          seats: { create: seatLines },
          items: withItem ? { create: [{ productId: product.id, quantity: 1, priceAtPurchase: product.price }] } : undefined,
          payment: {
            create: { provider: i % 3 === 0 ? "PAYPAL" : "STRIPE", providerPaymentId: `demo_pay_${i}`, amount: subtotal, status: "COMPLETED" },
          },
        },
      });
      await prisma.showtimeSeat.updateMany({ where: { id: { in: free.map((s) => s.id) } }, data: { status: "SOLD" } });

      const key = `${buyerId}:${showtime.movieId}`;
      if (!reviewed.has(key) && reviewed.size < 34) {
        reviewed.add(key);
        await prisma.review.create({
          data: {
            userId: buyerId,
            movieId: showtime.movieId,
            orderId: order.id,
            rating: 3 + (i % 3),
            comment: COMMENTS[i % COMMENTS.length],
            isVerifiedPurchase: true,
          },
        });
      }
    }
  }

  // ---- boleto fijo para probar la taquilla (codigo conocido)
  if (!(await prisma.order.findUnique({ where: { qrCode: "LMR-DEMO0001" } }))) {
    const showtime = await prisma.showtime.findFirst({ where: { startTime: { gt: new Date() } }, orderBy: { startTime: "desc" } });
    const seat = showtime && (await prisma.showtimeSeat.findFirst({ where: { showtimeId: showtime.id, status: "AVAILABLE" } }));
    if (showtime && seat) {
      await prisma.order.create({
        data: {
          userId: users["cliente@lumiere.test"]!,
          showtimeId: showtime.id,
          status: "PAID",
          subtotal: 45,
          totalAmount: 45,
          qrCode: "LMR-DEMO0001",
          seats: { create: [{ showtimeSeatId: seat.id, priceAtPurchase: 45 }] },
          payment: { create: { provider: "STRIPE", providerPaymentId: "demo_ticket_0001", amount: 45, status: "COMPLETED" } },
        },
      });
      await prisma.showtimeSeat.update({ where: { id: seat.id }, data: { status: "SOLD" } });
    }
  }
}
