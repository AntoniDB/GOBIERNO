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
    corruption: 5,
    skill: 70,
    reputation: 60,
    status: "ACTIVE",
    ...overrides,
  };
}

describe("calculateMinistryEfficiency", () => {
  it("calcula eficiencia con valores conocidos", () => {
    // budgetPercent=10, corrupción=10 → factorCorrupción=0.9, skill=70 → 0.7
    // raw = 10 * 0.9 * 0.7 * 1.0 = 6.3
    const ministry = crearMinisterio({ budgetPercent: 10, internalCorruption: 10 });
    const minister = crearMinistro({ skill: 70 });
    const eff = calculateMinistryEfficiency(ministry, minister);
    expect(eff).toBeCloseTo(6.3, 5);
  });

  it("eficiencia es 0 cuando presupuesto es 0", () => {
    const ministry = crearMinisterio({ budgetPercent: 0, internalCorruption: 0 });
    const minister = crearMinistro({ skill: 80 });
    expect(calculateMinistryEfficiency(ministry, minister)).toBe(0);
  });

  it("escala con la habilidad del ministro", () => {
    const ministry = crearMinisterio({ budgetPercent: 10, internalCorruption: 0 });
    const ministroBajo = crearMinistro({ skill: 30 });
    const ministroAlto = crearMinistro({ skill: 90 });
    const effBajo = calculateMinistryEfficiency(ministry, ministroBajo);
    const effAlto = calculateMinistryEfficiency(ministry, ministroAlto);
    expect(effAlto).toBeGreaterThan(effBajo);
  });

  it("usa habilidad 50 cuando no hay ministro asignado", () => {
    const ministry = crearMinisterio({ budgetPercent: 20, internalCorruption: 0 });
    // raw = 20 * 1.0 * 0.5 * 1.0 = 10
    expect(calculateMinistryEfficiency(ministry, undefined)).toBe(10);
  });

  it("se trunca a máximo 100", () => {
    const ministry = crearMinisterio({ budgetPercent: 100, internalCorruption: 0 });
    const minister = crearMinistro({ skill: 100 });
    expect(calculateMinistryEfficiency(ministry, minister)).toBe(100);
  });

  it("corrupción interna alta reduce la eficiencia", () => {
    const ministryLimpio = crearMinisterio({ budgetPercent: 20, internalCorruption: 0 });
    const ministryCorrupto = crearMinisterio({ budgetPercent: 20, internalCorruption: 80 });
    const minister = crearMinistro({ skill: 80 });
    const effLimpio = calculateMinistryEfficiency(ministryLimpio, minister);
    const effCorrupto = calculateMinistryEfficiency(ministryCorrupto, minister);
    expect(effLimpio).toBeGreaterThan(effCorrupto);
  });
});
