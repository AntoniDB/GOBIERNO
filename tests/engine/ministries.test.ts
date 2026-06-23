import { describe, it, expect } from "vitest";
import type { MinistryState, OfficialState } from "@/lib/engine/types";
import { calculateMinistryEfficiency } from "@/lib/engine/ministries";

function crearMinisterio(overrides?: Partial<MinistryState>): MinistryState {
  return {
    id: "min-test",
    key: "test",
    budgetPercent: 10,
    efficiency: 50,
    internalCorruption: 10,
    subDecisions: {},
    ministerOfficialId: null,
    ...overrides,
  };
}

function crearMinistro(overrides?: Partial<OfficialState>): OfficialState {
  return {
    id: "off-min",
    name: "Ministro de Prueba",
    role: "MINISTER",
    ministryId: "min-test",
    partyId: null,
    loyalty: 50,
    ambition: 30,
    wealth: 100000,
    ideology: { economic: 0, social: 0, authority: 0 },
    corruption: 0,
    skill: 70,
    reputation: 60,
    status: "ACTIVE",
    ...overrides,
  };
}

describe("calculateMinistryEfficiency", () => {
  it("calcula eficiencia como calidad de gestion pura (sin presupuesto)", () => {
    // corruption=0, skill=70 → (1 - 0) * 0.7 * 100 = 70
    const ministry = crearMinisterio();
    const minister = crearMinistro({ corruption: 0, skill: 70 });
    const eff = calculateMinistryEfficiency(ministry, minister);
    expect(eff).toBeCloseTo(70, 5);
  });

  it("usa corrupcion del ministro, no la interna del ministerio", () => {
    // minister.corruption=10, internalCorruption=0 → (1 - 10/100) * 0.7 * 100 = 63
    const ministry = crearMinisterio({ internalCorruption: 0 });
    const minister = crearMinistro({ corruption: 10, skill: 70 });
    const eff = calculateMinistryEfficiency(ministry, minister);
    expect(eff).toBeCloseTo(63, 5);
  });

  it("usa internalCorruption si no hay ministro", () => {
    const ministry = crearMinisterio({ internalCorruption: 20 });
    // (1 - 20/100) * 0.5 * 100 = 40
    expect(calculateMinistryEfficiency(ministry, undefined)).toBe(40);
  });

  it("escala con la habilidad del ministro", () => {
    const ministry = crearMinisterio();
    const ministroBajo = crearMinistro({ skill: 30 });
    const ministroAlto = crearMinistro({ skill: 90 });
    const effBajo = calculateMinistryEfficiency(ministry, ministroBajo);
    const effAlto = calculateMinistryEfficiency(ministry, ministroAlto);
    expect(effAlto).toBeGreaterThan(effBajo);
  });

  it("se trunca a maximo 100", () => {
    const ministry = crearMinisterio({ internalCorruption: 0 });
    const minister = crearMinistro({ corruption: 0, skill: 100 });
    expect(calculateMinistryEfficiency(ministry, minister)).toBe(100);
  });

  it("corrupcion alta reduce la eficiencia", () => {
    const ministry = crearMinisterio({ internalCorruption: 0 });
    const ministerLimpio = crearMinistro({ corruption: 0, skill: 80 });
    const ministerCorrupto = crearMinistro({ corruption: 80, skill: 80 });
    const effLimpio = calculateMinistryEfficiency(ministry, ministerLimpio);
    const effCorrupto = calculateMinistryEfficiency(ministry, ministerCorrupto);
    expect(effLimpio).toBeGreaterThan(effCorrupto);
  });
});
