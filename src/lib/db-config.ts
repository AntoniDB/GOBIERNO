// ─── Configuración de la conexión a PostgreSQL ────────────────────────────────
// Única fuente de la conexión para la app (`prisma.ts`), el seed y `db:check`.
// Todo sale de variables de entorno, así que apuntar a una base local o a un
// Postgres remoto (VPS) es cambiar `DATABASE_URL` (ver `.env.example`).
//
//   DATABASE_URL                    postgresql://usuario:clave@host:5432/base   (obligatoria)
//   DATABASE_SSL                    disable | require | verify                   (opcional)
//   DATABASE_SSL_CA                 certificado de la CA (PEM o ruta a archivo)  (solo con verify)
//   DATABASE_POOL_MAX               conexiones máximas del pool            (def. 10)
//   DATABASE_CONNECTION_TIMEOUT_MS  espera máxima para conectar            (def. 10000)
//   DATABASE_IDLE_TIMEOUT_MS        cierre de conexiones ociosas           (def. 30000)
//
// Por qué DATABASE_SSL existe aparte de `?sslmode=` en la URL: `pg` interpreta
// `sslmode=require` como verificación ESTRICTA del certificado (distinto de libpq), así
// que un VPS con certificado autofirmado fallaría; y lo que diga la URL pisa al resto
// de la configuración. Si DATABASE_SSL está definida, manda sobre la URL.
// La CLI de Prisma (`migrate deploy`) no lee DATABASE_SSL: su TLS se controla en la URL.
//
// Nunca se incluye la URL ni la contraseña en los mensajes de error.

import { readFileSync } from "fs";
import type { PoolConfig } from "pg";

type Env = Record<string, string | undefined>;
type ReadFile = (path: string) => string;

const SSL_MODES = ["disable", "require", "verify"] as const;
type SslMode = (typeof SSL_MODES)[number];

/** Parámetros de la URL que configuran TLS: se quitan cuando DATABASE_SSL manda. */
const URL_SSL_PARAMS = ["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert", "sslaccept", "uselibpqcompat", "sslnegotiation"];

export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigError";
  }
}

function parseUrl(raw: string | undefined): URL {
  if (!raw || raw.trim() === "") {
    throw new DatabaseConfigError(
      "Falta DATABASE_URL. Defínela en .env (ver .env.example), p. ej. postgresql://usuario:clave@host:5432/base",
    );
  }
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new DatabaseConfigError(
      "DATABASE_URL no es una URL válida. Si la contraseña tiene caracteres especiales (@ : / ? # %), codifícala (p. ej. @ → %40).",
    );
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new DatabaseConfigError("DATABASE_URL debe empezar por postgresql:// o postgres://");
  }
  if (!url.hostname) throw new DatabaseConfigError("DATABASE_URL no indica el host del servidor.");
  if (url.pathname.length <= 1) throw new DatabaseConfigError("DATABASE_URL no indica el nombre de la base de datos (…/nombre).");
  return url;
}

function positiveInt(env: Env, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new DatabaseConfigError(`${name} debe ser un entero positivo (recibido: "${raw}").`);
  }
  return value;
}

function parseSslMode(raw: string | undefined): SslMode | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  const mode = raw.trim().toLowerCase();
  if (!(SSL_MODES as readonly string[]).includes(mode)) {
    throw new DatabaseConfigError(`DATABASE_SSL debe ser uno de: ${SSL_MODES.join(", ")} (recibido: "${raw}").`);
  }
  return mode as SslMode;
}

function loadCa(value: string, readFile: ReadFile): string {
  if (value.includes("-----BEGIN")) return value;
  try {
    return readFile(value);
  } catch {
    throw new DatabaseConfigError("DATABASE_SSL_CA no es un certificado PEM ni una ruta legible.");
  }
}

/**
 * Configuración del pool de `pg` (la que recibe `PrismaPg`) a partir del entorno.
 * @throws DatabaseConfigError con un mensaje accionable y sin secretos
 */
export function buildPoolConfig(env: Env = process.env, readFile: ReadFile = (p) => readFileSync(p, "utf-8")): PoolConfig {
  const url = parseUrl(env.DATABASE_URL);
  const sslMode = parseSslMode(env.DATABASE_SSL);
  const ca = env.DATABASE_SSL_CA?.trim();
  if (ca && sslMode !== "verify") {
    throw new DatabaseConfigError("DATABASE_SSL_CA solo se usa con DATABASE_SSL=verify.");
  }

  const config: PoolConfig = {
    max: positiveInt(env, "DATABASE_POOL_MAX", 10),
    connectionTimeoutMillis: positiveInt(env, "DATABASE_CONNECTION_TIMEOUT_MS", 10_000),
    idleTimeoutMillis: positiveInt(env, "DATABASE_IDLE_TIMEOUT_MS", 30_000),
  };

  if (sslMode === undefined) {
    // Sin DATABASE_SSL: se respeta lo que diga la URL (sin nada → sin TLS, caso local/Docker)
    config.connectionString = url.toString();
    return config;
  }

  // DATABASE_SSL manda: la URL pisaría `ssl` (pg la fusiona encima), así que se le quitan sus parámetros TLS
  for (const param of URL_SSL_PARAMS) url.searchParams.delete(param);
  config.connectionString = url.toString();
  if (sslMode === "disable") config.ssl = false;
  else if (sslMode === "require") config.ssl = { rejectUnauthorized: false }; // cifra, acepta certificado autofirmado
  else config.ssl = ca ? { rejectUnauthorized: true, ca: loadCa(ca, readFile) } : { rejectUnauthorized: true };
  return config;
}

/** Destino legible de la conexión (sin contraseña), para mensajes y `db:check`. */
export function describeDatabaseTarget(env: Env = process.env): string {
  const url = parseUrl(env.DATABASE_URL);
  const user = decodeURIComponent(url.username);
  return `${user ? `${user}@` : ""}${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
}
