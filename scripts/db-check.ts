// Comprueba la conexión a PostgreSQL con la misma configuración que usa la app.
//   npm run db:check
// Muestra servidor, usuario, si la sesión va cifrada (SSL), latencia y migraciones aplicadas.
// Sale con código 1 si no puede conectar. Nunca imprime la contraseña.

import { readdirSync } from "fs";
import { join } from "path";
import { Pool } from "pg";
import { buildPoolConfig, describeDatabaseTarget, DatabaseConfigError } from "../src/lib/db-config";

// Carga .env si existe (Node ≥ 20.12); las variables ya definidas en el entorno tienen prioridad
try {
  process.loadEnvFile();
} catch {
  /* sin .env: se usa el entorno tal cual */
}

async function main(): Promise<void> {
  let target: string;
  let pool: Pool;
  try {
    target = describeDatabaseTarget();
    pool = new Pool(buildPoolConfig());
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      console.error(`✗ Configuración inválida: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
  pool.on("error", () => {}); // un error en un cliente ocioso no debe tumbar el chequeo

  console.log(`→ Conectando a ${target} …`);
  try {
    const started = Date.now();
    const client = await pool.connect();
    const connectMs = Date.now() - started;
    try {
      const pingStart = Date.now();
      await client.query("SELECT 1");
      const pingMs = Date.now() - pingStart;

      const info = await client.query<{ version: string; user: string; db: string }>(
        "SELECT version() AS version, current_user AS \"user\", current_database() AS db",
      );
      const ssl = await client.query<{ ssl: boolean; version: string | null; cipher: string | null }>(
        "SELECT ssl, version, cipher FROM pg_stat_ssl WHERE pid = pg_backend_pid()",
      );

      console.log(`✓ Conectado en ${connectMs} ms (consulta: ${pingMs} ms)`);
      console.log(`  Servidor : ${info.rows[0].version.split(",")[0]}`);
      console.log(`  Usuario  : ${info.rows[0].user}   Base: ${info.rows[0].db}`);
      const s = ssl.rows[0];
      console.log(`  Cifrado  : ${s?.ssl ? `sí (${s.version}, ${s.cipher})` : "NO — la conexión viaja sin cifrar"}`);

      const local = readdirSync(join(process.cwd(), "prisma", "migrations"), { withFileTypes: true })
        .filter((d) => d.isDirectory()).length;
      try {
        const applied = await client.query<{ n: string }>(
          "SELECT count(*) AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL",
        );
        const n = Number(applied.rows[0].n);
        console.log(`  Migraciones: ${n} aplicadas de ${local}${n < local ? "  → ejecuta: npx prisma migrate deploy" : ""}`);
      } catch {
        console.log(`  Migraciones: la base está vacía (0 de ${local})  → ejecuta: npx prisma migrate deploy`);
      }
    } finally {
      client.release();
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`✗ No se pudo conectar: ${reason}`);
    console.error("  Revisa: host/puerto/firewall del VPS, usuario y contraseña, y DATABASE_SSL (require si el certificado es autofirmado).");
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
