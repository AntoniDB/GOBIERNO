import { describe, it, expect } from "vitest";
import { buildPoolConfig, describeDatabaseTarget, DatabaseConfigError } from "@/lib/db-config";

const URL_OK = "postgresql://app:s3cr3t@db.example.com:5432/simulador";
const cfg = (env: Record<string, string | undefined>, readFile?: (p: string) => string) =>
  buildPoolConfig({ DATABASE_URL: URL_OK, ...env }, readFile);

describe("buildPoolConfig: URL", () => {
  it("devuelve la URL y los valores por defecto del pool", () => {
    const c = cfg({});
    expect(c.connectionString).toBe(URL_OK);
    expect(c.max).toBe(10);
    expect(c.connectionTimeoutMillis).toBe(10_000);
    expect(c.idleTimeoutMillis).toBe(30_000);
    expect(c.ssl).toBeUndefined();
  });

  it("acepta los esquemas postgres:// y postgresql://", () => {
    expect(() => buildPoolConfig({ DATABASE_URL: "postgres://u:p@h:5432/d" })).not.toThrow();
  });

  it.each([
    ["falta", undefined],
    ["vacía", "   "],
    ["no es una URL", "esto no es una url"],
    ["esquema distinto", "mysql://u:p@h:3306/d"],
    ["sin host", "postgresql:///d"],
    ["sin base de datos", "postgresql://u:p@h:5432"],
  ])("rechaza una URL %s con DatabaseConfigError", (_caso, valor) => {
    expect(() => buildPoolConfig({ DATABASE_URL: valor })).toThrow(DatabaseConfigError);
  });

  it("los mensajes de error no filtran la contraseña", () => {
    for (const env of [
      { DATABASE_URL: "mysql://app:s3cr3t@h/d" }, // esquema equivocado
      { DATABASE_URL: "postgresql://app:s3cr3t@h" }, // sin base
      { DATABASE_URL: "postgresql://app:s3cr3t@/d" }, // sin host
      { DATABASE_URL: "postgresql://app:s3cr3t@h:99999999/d" }, // puerto inválido (URL no parseable)
      { DATABASE_URL: URL_OK, DATABASE_SSL: "maybe" },
    ]) {
      try {
        buildPoolConfig(env);
        throw new Error("debía fallar");
      } catch (error) {
        expect((error as Error).message).not.toContain("s3cr3t");
      }
    }
  });
});

describe("buildPoolConfig: SSL", () => {
  it("sin DATABASE_SSL respeta lo que diga la URL (no toca sslmode)", () => {
    const c = cfg({ DATABASE_URL: `${URL_OK}?sslmode=require` });
    expect(c.connectionString).toContain("sslmode=require");
    expect(c.ssl).toBeUndefined();
  });

  it("disable → sin TLS", () => {
    expect(cfg({ DATABASE_SSL: "disable" }).ssl).toBe(false);
  });

  it("require → cifra y acepta certificado autofirmado", () => {
    expect(cfg({ DATABASE_SSL: "require" }).ssl).toEqual({ rejectUnauthorized: false });
  });

  it("verify → verifica el certificado, con o sin CA", () => {
    expect(cfg({ DATABASE_SSL: "verify" }).ssl).toEqual({ rejectUnauthorized: true });
    const pem = "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----";
    expect(cfg({ DATABASE_SSL: "verify", DATABASE_SSL_CA: pem }).ssl).toEqual({ rejectUnauthorized: true, ca: pem });
  });

  it("la CA puede ser una ruta de archivo", () => {
    const leidos: string[] = [];
    const c = cfg({ DATABASE_SSL: "verify", DATABASE_SSL_CA: "/etc/ssl/vps-ca.pem" }, (p) => { leidos.push(p); return "PEM-DEL-ARCHIVO"; });
    expect(leidos).toEqual(["/etc/ssl/vps-ca.pem"]);
    expect(c.ssl).toEqual({ rejectUnauthorized: true, ca: "PEM-DEL-ARCHIVO" });
  });

  it("una ruta ilegible da un error claro", () => {
    expect(() => cfg({ DATABASE_SSL: "verify", DATABASE_SSL_CA: "/no/existe.pem" }, () => { throw new Error("ENOENT"); })).toThrow(/DATABASE_SSL_CA/);
  });

  it("DATABASE_SSL manda sobre la URL: se le quitan los parámetros TLS (pg los fusionaría encima)", () => {
    const c = cfg({ DATABASE_URL: `${URL_OK}?sslmode=require&sslaccept=strict&application_name=gobierno`, DATABASE_SSL: "require" });
    expect(c.connectionString).not.toMatch(/ssl/i);
    expect(c.connectionString).toContain("application_name=gobierno"); // lo demás se conserva
    expect(c.ssl).toEqual({ rejectUnauthorized: false });
  });

  it("valor inválido de DATABASE_SSL, o CA sin verify, es un error", () => {
    expect(() => cfg({ DATABASE_SSL: "maybe" })).toThrow(/disable, require, verify/);
    expect(() => cfg({ DATABASE_SSL: "require", DATABASE_SSL_CA: "x" })).toThrow(/verify/);
  });

  it("no distingue mayúsculas ni espacios", () => {
    expect(cfg({ DATABASE_SSL: "  REQUIRE " }).ssl).toEqual({ rejectUnauthorized: false });
  });
});

describe("buildPoolConfig: pool y timeouts", () => {
  it("lee los valores de entorno", () => {
    const c = cfg({ DATABASE_POOL_MAX: "25", DATABASE_CONNECTION_TIMEOUT_MS: "3000", DATABASE_IDLE_TIMEOUT_MS: "5000" });
    expect([c.max, c.connectionTimeoutMillis, c.idleTimeoutMillis]).toEqual([25, 3000, 5000]);
  });

  it.each(["0", "-3", "abc", "2.5"])("rechaza %s como tamaño de pool", (valor) => {
    expect(() => cfg({ DATABASE_POOL_MAX: valor })).toThrow(/DATABASE_POOL_MAX/);
  });

  it("un valor vacío usa el defecto", () => {
    expect(cfg({ DATABASE_POOL_MAX: "" }).max).toBe(10);
  });
});

describe("describeDatabaseTarget", () => {
  it("muestra usuario, host, puerto y base, sin contraseña", () => {
    const t = describeDatabaseTarget({ DATABASE_URL: URL_OK });
    expect(t).toBe("app@db.example.com:5432/simulador");
    expect(t).not.toContain("s3cr3t");
  });
});
