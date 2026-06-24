import { describe, it, expect } from "vitest";
import type { GameState, MinistryState, OfficialState } from "@/lib/engine/types";
import {
  calculateMinistryInternalCorruption,
  calculateMinistryEfficiency,
  getMinistryDirectors,
} from "@/lib/engine/ministries";

function crearMinistry(overrides?: Partial<MinistryState>): MinistryState {
  return {
    id: "min-health",
    key: "HEALTH",
    budgetPercent: 14,
    efficiency: 50,
    internalCorruption: 10,
    subDecisions: {},
    ministerOfficialId: "off-minister",
    producedResources: {},
    consumedResources: {},
    ...overrides,
  };
}

function crearOfficial(
  id: string,
  role: string,
  overrides?: Partial<OfficialState>
): OfficialState {
  return {
    id,
    name: `Funcionario ${id}`,
    role,
    specialty: null,
    ministryId: null,
    partyId: null,
    loyalty: 50,
    ambition: 30,
    wealth: 100000,
    ideology: { economic: 0, social: 0, authority: 0 },
    corruption: 10,
    skill: 60,
    reputation: 50,
    status: "ACTIVE",
    ...overrides,
  };
}

function crearDirector(
  id: string,
  specialty: string,
  ministryId: string,
  overrides?: Partial<OfficialState>
): OfficialState {
  return crearOfficial(id, "MINISTRY_DIRECTOR", {
    specialty,
    ministryId,
    ...overrides,
  });
}

describe("calculateMinistryInternalCorruption", () => {
  it("sin ministro ni directores, usa internalCorruption", () => {
    const ministry = crearMinistry({ ministerOfficialId: null, internalCorruption: 25 });
    const officials: OfficialState[] = [];
    const result = calculateMinistryInternalCorruption(ministry, officials);
    expect(result).toBe(25);
  });

  it("solo ministro, sin directores → corrupcion del ministro", () => {
    const ministry = crearMinistry({ ministerOfficialId: "off-min" });
    const officials: OfficialState[] = [
      crearOfficial("off-min", "MINISTER", { corruption: 30, ministryId: "min-health" }),
    ];
    const result = calculateMinistryInternalCorruption(ministry, officials);
    expect(result).toBe(30);
  });

  it("ministro + 3 directores → promedio ponderado 60/40%", () => {
    const ministry = crearMinistry({ ministerOfficialId: "off-min" });
    const officials: OfficialState[] = [
      crearOfficial("off-min", "MINISTER", { corruption: 20, ministryId: "min-health" }),
      crearDirector("off-d1", "health_hospitals", "min-health", { corruption: 40 }),
      crearDirector("off-d2", "health_public", "min-health", { corruption: 50 }),
      crearDirector("off-d3", "health_epidemiology", "min-health", { corruption: 30 }),
    ];
    // 20 * 0.6 + 40 * 0.1333 + 50 * 0.1333 + 30 * 0.1333 = 12 + 5.33 + 6.67 + 4 = 28.0
    const result = calculateMinistryInternalCorruption(ministry, officials);
    expect(result).toBeCloseTo(28, 0);
  });

  it("si falta 1 director, su peso se redistribuye al ministro", () => {
    const ministry = crearMinistry({ ministerOfficialId: "off-min" });
    const officials: OfficialState[] = [
      crearOfficial("off-min", "MINISTER", { corruption: 20, ministryId: "min-health" }),
      crearDirector("off-d1", "health_hospitals", "min-health", { corruption: 40 }),
      crearDirector("off-d2", "health_public", "min-health", { corruption: 50 }),
      // solo 2 de 3 directores
    ];
    // pesos: ministro 0.6, cada director 0.1333. Solo 2 directores = 0.8667 total.
    // Remaining 0.1333 goes to minister.
    // 20 * (0.6+0.1333) + 40*0.1333 + 50*0.1333 = 14.67 + 5.33 + 6.67 ≈ 26.7
    const result = calculateMinistryInternalCorruption(ministry, officials);
    expect(result).toBeGreaterThan(20);
    expect(result).toBeLessThan(35);
  });

  it("solo directores, sin ministro → promedio simple", () => {
    const ministry = crearMinistry({ ministerOfficialId: "off-min" });
    const officials: OfficialState[] = [
      crearDirector("off-d1", "health_hospitals", "min-health", { corruption: 30 }),
      crearDirector("off-d2", "health_public", "min-health", { corruption: 50 }),
    ];
    const result = calculateMinistryInternalCorruption(ministry, officials);
    expect(result).toBe(40);
  });

  it("ignora officials INACTIVE o de otros ministerios", () => {
    const ministry = crearMinistry({ ministerOfficialId: "off-min" });
    const officials: OfficialState[] = [
      crearOfficial("off-min", "MINISTER", { corruption: 20, ministryId: "min-health" }),
      crearDirector("off-d1", "health_hospitals", "min-health", { corruption: 40 }),
      crearDirector("off-d2", "health_public", "min-other", { corruption: 99 }), // otro ministerio
      crearDirector("off-d3", "health_epidemiology", "min-health", { corruption: 30, status: "DISMISSED" }), // inactivo
    ];
    // Solo ministro (20) + d1 (40). Total dirs activos = 1. weight = 0.6 + 0.4 = 1.0.
    // 20*0.6 + 40*0.4 = 12 + 16 = 28
    const result = calculateMinistryInternalCorruption(ministry, officials);
    expect(result).toBeCloseTo(28, 0);
  });
});

describe("calculateMinistryEfficiency with directors", () => {
  it("sin directores, skillFactor usa solo ministro", () => {
    const ministry = crearMinistry();
    const minister = crearOfficial("off-min", "MINISTER", { corruption: 0, skill: 80 });
    const eff = calculateMinistryEfficiency(ministry, minister);
    // (1 - 0) * 0.8 * 100 = 80
    expect(eff).toBe(80);
  });

  it("con directores, combina 70% ministro + 30% promedio directores", () => {
    const ministry = crearMinistry();
    const minister = crearOfficial("off-min", "MINISTER", { corruption: 0, skill: 80 });
    const directors: OfficialState[] = [
      crearDirector("off-d1", "health_hospitals", "min-health", { skill: 50 }),
      crearDirector("off-d2", "health_public", "min-health", { skill: 70 }),
    ];
    // avg director = 60. combined skill = 80*0.7 + 60*0.3 = 56 + 18 = 74
    // eff = (1 - 0) * 0.74 * 100 = 74
    const eff = calculateMinistryEfficiency(ministry, minister, directors);
    expect(eff).toBe(74);
  });

  it("directores con skill baja reducen la eficiencia", () => {
    const ministry = crearMinistry();
    const minister = crearOfficial("off-min", "MINISTER", { corruption: 0, skill: 80 });
    const directors: OfficialState[] = [
      crearDirector("off-d1", "health_hospitals", "min-health", { skill: 10 }),
    ];
    // skill = 80*0.7 + 10*0.3 = 56 + 3 = 59 → eff = 59
    const eff = calculateMinistryEfficiency(ministry, minister, directors);
    expect(eff).toBe(59);
  });
});

describe("getMinistryDirectors", () => {
  it("retorna solo MINISTRY_DIRECTOR con ministryId y status ACTIVE", () => {
    const ministry = crearMinistry();
    const officials: OfficialState[] = [
      crearDirector("off-d1", "health_hospitals", "min-health"),
      crearDirector("off-d2", "health_public", "min-health", { status: "DISMISSED" }),
      crearDirector("off-d3", "education_stem", "min-edu"), // otro ministerio
      crearOfficial("off-min", "MINISTER", { ministryId: "min-health" }),
    ];
    const directors = getMinistryDirectors(ministry, officials);
    expect(directors).toHaveLength(1);
    expect(directors[0].id).toBe("off-d1");
  });
});
