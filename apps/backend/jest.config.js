/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  setupFiles: ["<rootDir>/../jest.setup.js"],
  testMatch: ["**/*.test.ts"],
  clearMocks: true,
  // La primera peticion de cada suite conecta Prisma/Redis y, tras editar codigo, ts-jest recompila en frio:
  // con el limite por defecto (5 s) esa primera prueba fallaba de forma intermitente sin ser un error real.
  testTimeout: 20000,
};
