require("dotenv").config({ path: require("node:path").resolve(__dirname, ".env") });

// ioredis tiene una condicion de carrera conocida al cerrar la conexion
// (redis.quit()) justo cuando el proceso de Jest esta terminando: el socket
// dispara un evento 'close' del SO que ioredis traduce en una excepcion
// sincrona "Connection is closed." fuera de cualquier try/catch nuestro.
// No es un fallo de los tests (todos ya reportaron su resultado en ese punto)
// - se filtra puntualmente este mensaje exacto; cualquier otro error no
// manejado se re-lanza normalmente.
process.on("uncaughtException", (err) => {
  if (err instanceof Error && err.message === "Connection is closed.") {
    return;
  }
  throw err;
});
