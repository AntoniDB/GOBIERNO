// Regenera el cliente de Prisma (src/generated/prisma, ignorado por git). Se ejecuta en `postinstall`
// para que tras cada `git pull` + `npm install` el cliente coincida con el esquema (sin esto, un campo
// nuevo da "Unknown argument …" al usarlo). `prisma generate` solo lee el esquema, pero prisma.config.ts
// exige DATABASE_URL; en un clon nuevo, CI o un build de Docker puede no existir todavía, así que se
// define un valor ficticio SOLO para este proceso (nunca se conecta). No afecta a migrate/seed ni a la app.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");

const result = spawnSync(process.execPath, [prismaCli, "generate"], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || "postgresql://generate:generate@localhost:5432/generate",
  },
});

process.exit(result.status ?? 1);
