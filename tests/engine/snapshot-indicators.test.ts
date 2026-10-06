import { describe, it, expect } from "vitest";
import { snapshotIndicators, initialEconomy } from "@/lib/initial-economy";
import { generateCandidates } from "@/lib/engine/candidates";
import { createRNG } from "@/lib/rng";
import type { GameState } from "@/lib/engine/types";

const inicial = initialEconomy("estable_democratico", "normal");

describe("snapshotIndicators", () => {
  it("toma los indicadores del último snapshot", () => {
    const s = snapshotIndicators(
      { gdp: 9, povertyRate: 1, unemploymentRate: 2, sickRate: 3, crimeRate: 4, foodSecurity: 5, educationLevel: 6, inflation: 7, lifeExpectancy: 8 },
      inicial,
    );
    expect(s).toEqual({ gdp: 9, povertyRate: 1, unemploymentRate: 2, sickRate: 3, crimeRate: 4, foodSecurity: 5, educationLevel: 6, inflation: 7, lifeExpectancy: 8 });
  });

  it("sin snapshot usa el preset donde existe y valores neutros en el resto", () => {
    const s = snapshotIndicators(null, inicial);
    expect(s.gdp).toBe(inicial.gdp);
    expect(s.povertyRate).toBe(inicial.povertyRate);
    expect(s.unemploymentRate).toBe(inicial.unemploymentRate);
    expect(s.inflation).toBe(inicial.inflation);
    expect([s.sickRate, s.crimeRate, s.foodSecurity, s.educationLevel, s.lifeExpectancy]).toEqual([0, 0, 0, 0, 68]);
  });

  it("nunca devuelve undefined ni NaN (ese era el origen de candidatos con skill NaN)", () => {
    for (const snapshot of [null, undefined, {}, { educationLevel: null }]) {
      for (const valor of Object.values(snapshotIndicators(snapshot, inicial))) {
        expect(Number.isFinite(valor)).toBe(true);
      }
    }
  });

  it("con la educación cargada los candidatos nacen con skill finito y pueden salir 2-3", () => {
    const estado = (educationLevel: number) => ({
      currentYear: 1, currentMonth: 6, regimeMetrics: { transparency: 50 }, ...snapshotIndicators({ educationLevel }, inicial),
    }) as unknown as GameState;
    let maximo = 0;
    for (let i = 0; i < 200; i++) {
      const candidatos = generateCandidates(estado(80), createRNG(`s${i}`));
      maximo = Math.max(maximo, candidatos.length);
      for (const c of candidatos) expect(Number.isFinite(c.skill)).toBe(true);
    }
    expect(maximo).toBe(3); // educación > 70 → 2-3 candidatos
  });

  it("regresión: sin el campo (como llegaba antes) el skill era NaN", () => {
    const sinEducacion = { currentYear: 1, currentMonth: 6, regimeMetrics: { transparency: 50 } } as unknown as GameState;
    const todos = Array.from({ length: 50 }, (_, i) => generateCandidates(sinEducacion, createRNG(`s${i}`))).flat();
    expect(todos.length).toBeGreaterThan(0);
    expect(todos.every((c) => Number.isNaN(c.skill))).toBe(true);
  });
});
