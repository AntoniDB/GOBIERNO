import { describe, it, expect } from "vitest";
import { buildEventPrompt } from "@/lib/ai/prompts/events";
import { buildCoveragePrompt } from "@/lib/ai/prompts/media";
import type { EventState, GameState, MediaState } from "@/lib/engine/types";

function crearEstadoMinimo(): GameState {
  return {
    countryName: "República de Prueba",
    currentYear: 2026,
    currentMonth: 3,
    treasury: 500_000_000,
    population: 10_000_000,
    seed: "test-seed",
    gdp: 50_000_000,
    povertyRate: 25,
    unemploymentRate: 8,
    sickRate: 5,
    crimeRate: 12,
    foodSecurity: 70,
    educationLevel: 55,
    inflation: 4.2,
    ministries: [
      {
        id: "min-health",
        key: "HEALTH",
        budgetPercent: 10,
        efficiency: 45,
        internalCorruption: 15,
        subDecisions: {},
        ministerOfficialId: "off-1",
      },
      {
        id: "min-security",
        key: "SECURITY",
        budgetPercent: 8,
        efficiency: 60,
        internalCorruption: 10,
        subDecisions: {},
        ministerOfficialId: null,
      },
    ],
    officials: [
      {
        id: "off-1",
        name: "Dr. García",
        role: "MINISTER",
        ministryId: "min-health",
        partyId: null,
        loyalty: 70,
        ambition: 40,
        wealth: 50000,
        ideology: { economic: 0, social: 0, authority: 0 },
        corruption: 20,
        skill: 65,
        reputation: 55,
        status: "ACTIVE",
      },
    ],
    parties: [],
    senators: [],
    activeLaws: [],
    judicialCases: [],
    organisms: [],
    socialClasses: [
      {
        id: "sc-extreme",
        key: "EXTREME_POVERTY",
        populationPercent: 20,
        averageIncome: 200,
        approval: 30,
        demands: ["alimentación", "empleo"],
        educationLevel: 20,
        healthAccess: 30,
      },
    ],
    regimeMetrics: {
      powerConcentration: 30,
      pressFreedom: 70,
      judicialIndependence: 60,
      politicalPluralism: 70,
      civilLiberties: 70,
      transparency: 50,
      militarySubordination: 60,
    },
    media: [],
    events: [],
    consecutiveLowApprovalMonths: 0,
  };
}

function crearEvento(type: string, severity: number): EventState {
  return {
    id: "evt-test-1",
    type,
    severity,
    year: 2026,
    month: 3,
    description: `Evento de prueba tipo ${type}`,
    effectsApplied: {},
    resolvedAt: null,
  };
}

function crearMedio(affinity: number): MediaState {
  return {
    id: "media-1",
    name: "El Diario Nacional",
    type: "NEWSPAPER",
    ideologicalAffinity: { economic: 0, social: 0, authority: 0 },
    reach: 60,
    credibility: 70,
    governmentAffinity: affinity,
    status: "ACTIVE",
  };
}

describe("buildEventPrompt", () => {
  const state = crearEstadoMinimo();

  it("debe incluir el nombre del país en el prompt", () => {
    const event = crearEvento("EPIDEMIC", 50);
    const { user } = buildEventPrompt(event, state);
    expect(user).toContain("República de Prueba");
  });

  it("debe incluir el nombre del ministro cuando está asignado", () => {
    const event = crearEvento("EPIDEMIC", 50);
    const { user } = buildEventPrompt(event, state);
    expect(user).toContain("Dr. García");
  });

  it('debe indicar "No asignado" cuando no hay ministro', () => {
    const event = crearEvento("CRIME_SURGE", 50);
    const { user } = buildEventPrompt(event, state);
    expect(user).toContain("No asignado");
  });

  it("debe incluir indicadores sociales en el prompt", () => {
    const event = crearEvento("EPIDEMIC", 50);
    const { user } = buildEventPrompt(event, state);
    expect(user).toContain("25");
    expect(user).toContain("8");
  });

  it("debe usar español en el system prompt", () => {
    const event = crearEvento("SCANDAL", 30);
    const { system } = buildEventPrompt(event, state);
    expect(system).toContain("español");
  });

  it("debe incluir palabras clave en español en el user prompt", () => {
    const event = crearEvento("PROTEST", 70);
    const { user } = buildEventPrompt(event, state);
    expect(user).toContain("crónica");
    expect(user).toContain("PAÍS");
  });

  it("debe mapear correctamente el tipo de evento a etiqueta en español", () => {
    const event = crearEvento("COUP_ATTEMPT", 80);
    const { user } = buildEventPrompt(event, state);
    expect(user).toContain("intento de golpe de Estado");
  });

  it("debe etiquetar la severidad correctamente", () => {
    const leve = crearEvento("EPIDEMIC", 20);
    const moderada = crearEvento("EPIDEMIC", 45);
    const grave = crearEvento("EPIDEMIC", 75);

    expect(buildEventPrompt(leve, state).user).toContain("leve");
    expect(buildEventPrompt(moderada, state).user).toContain("moderada");
    expect(buildEventPrompt(grave, state).user).toContain("grave");
  });
});

describe("buildCoveragePrompt", () => {
  const event = crearEvento("SCANDAL", 60);

  it("debe incluir el nombre del medio en el system prompt", () => {
    const medio = crearMedio(0);
    const { system } = buildCoveragePrompt(medio, event, 0, "Testlandia");
    expect(system).toContain("El Diario Nacional");
  });

  it("debe incluir instrucción de sesgo para medio afín", () => {
    const medio = crearMedio(50);
    const { system } = buildCoveragePrompt(medio, event, 0.5, "Testlandia");
    expect(system).toContain("afín al gobierno");
  });

  it("debe incluir instrucción de sesgo para medio opositor", () => {
    const medio = crearMedio(-50);
    const { system } = buildCoveragePrompt(medio, event, -0.5, "Testlandia");
    expect(system).toContain("opositor");
  });

  it("debe incluir instrucción neutral para medio sin sesgo fuerte", () => {
    const medio = crearMedio(0);
    const { system } = buildCoveragePrompt(medio, event, 0, "Testlandia");
    expect(system).toContain("neutral");
  });

  it("debe incluir el nombre del país en el system prompt", () => {
    const medio = crearMedio(0);
    const { system } = buildCoveragePrompt(medio, event, 0, "Testlandia");
    expect(system).toContain("Testlandia");
  });

  it("debe incluir la afinidad del medio en el user prompt", () => {
    const medio = crearMedio(75);
    const { user } = buildCoveragePrompt(medio, event, 0.8, "Testlandia");
    expect(user).toContain("75/100");
  });

  it("debe incluir la descripción del evento en el user prompt", () => {
    const medio = crearMedio(0);
    const { user } = buildCoveragePrompt(medio, event, 0, "Testlandia");
    expect(user).toContain("Evento de prueba tipo SCANDAL");
  });
});
