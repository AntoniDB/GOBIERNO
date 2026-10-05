import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { BALANCE } from "@/lib/balance";

// BALANCE.md cita constantes con su valor: `NOMBRE` (0.3). Si alguien cambia balance.ts y no
// el documento, este test falla (antes la inflación, la pobreza o la corrupción llevaban
// valores obsoletos sin que nadie lo notara).

const doc = readFileSync(join(__dirname, "..", "BALANCE.md"), "utf-8");
const valores = BALANCE as unknown as Record<string, unknown>;

const citas = [...doc.matchAll(/`([A-Z][A-Z0-9_]+)`\s*\((-?\d[\d.,_]*)\s*%?\)/g)].map((m) => ({
  nombre: m[1],
  valor: Number(m[2].replace(/_/g, "").replace(",", ".")),
}));

describe("BALANCE.md está al día con balance.ts", () => {
  it("encuentra citas de constantes en el documento", () => {
    expect(citas.length).toBeGreaterThan(30);
  });

  it("toda constante citada con su valor coincide con balance.ts", () => {
    const distintas = citas
      .filter((c) => typeof valores[c.nombre] === "number" && valores[c.nombre] !== c.valor)
      .map((c) => `${c.nombre}: doc=${c.valor} código=${valores[c.nombre]}`);
    expect(distintas).toEqual([]);
  });

  it("toda constante citada existe en balance.ts (no quedan nombres obsoletos)", () => {
    // Excepciones: constantes que viven fuera de BALANCE o con otra forma en el código
    const inexistentes = citas.filter((c) => !(c.nombre in valores)).map((c) => c.nombre);
    expect(inexistentes).toEqual([]);
  });
});
