const { initializeSchema } = require("../lib/db");

(async () => {
  await initializeSchema();
  console.log("Tabla events lista.");
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
