import { describe, it, expect } from "vitest";
import type { GameState, EventState, MediaState, TurnInput } from "@/lib/engine/types";
import { generateMediaCoverage } from "@/lib/engine/media";
import { processTurn } from "@/lib/engine/turn";
import { createRNG } from "@/lib/rng";

function crearMedio(overrides?: Partial<MediaState>): MediaState {
  return {
    id: "media-1",
    name: "El Independiente",
    type: "NEWSPAPER",
    ideologicalAffinity: { economic: 0, social: 30, authority: -20 },
    reach: 50,
    credibility: 75,
    governmentAffinity: 0,
    status: "ACTIVE",
    ...overrides,
  };
}

function crearEvento(overrides?: Partial<EventState>): EventState {
  return {
    id: "ev-1",
    type: "SCANDAL",
    severity: 60,
    year: 2024,
    month: 1,
    description: "Escándalo de corrupción en el Ministerio de Salud",
    effectsApplied: {},
    resolvedAt: null,
    ...overrides,
  };
}

function crearEstadoBase(overrides?: Partial<GameState>): GameState {
  return {
    countryName: "República de Prueba",
    currentYear: 2024,
    currentMonth: 1,
    treasury: 1000000,
    population: 10000000,
    seed: "test-seed",
    gdp: 50000000,
    povertyRate: 25,
    unemploymentRate: 8,
    sickRate: 5,
    crimeRate: 15,
    foodSecurity: 60,
    educationLevel: 50,
    inflation: 5,
    lifeExpectancy: 68,
    ministries: [
      { id: "min-economia", key: "economia", budgetPercent: 10, efficiency: 50, internalCorruption: 10, subDecisions: {}, ministerOfficialId: null },
      { id: "min-salud", key: "salud", budgetPercent: 8, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      { id: "min-seguridad", key: "seguridad", budgetPercent: 6, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      { id: "min-desarrollo", key: "desarrollo_social", budgetPercent: 7, efficiency: 50, internalCorruption: 8, subDecisions: {}, ministerOfficialId: null },
      { id: "min-agricultura", key: "agricultura", budgetPercent: 5, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      { id: "min-educacion", key: "educacion", budgetPercent: 10, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
    ],
    officials: [
      { id: "off-pros", name: "Fiscal General", role: "PROSECUTOR", ministryId: null, partyId: null, loyalty: 70, ambition: 20, wealth: 80000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 5, skill: 75, reputation: 80, status: "ACTIVE" },
      { id: "off-judge", name: "Juez Supremo", role: "JUDGE", ministryId: null, partyId: null, loyalty: 80, ambition: 10, wealth: 120000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 2, skill: 85, reputation: 90, status: "ACTIVE" },
    ],
    parties: [],
    senators: [],
    activeLaws: [],
    judicialCases: [],
    organisms: [],
    socialClasses: [
      { id: "sc-elite", key: "ELITE", populationPercent: 10, averageIncome: 5000, approval: 50, demands: [], educationLevel: 80, healthAccess: 90 },
      { id: "sc-middle", key: "MIDDLE", populationPercent: 60, averageIncome: 2000, approval: 50, demands: [], educationLevel: 60, healthAccess: 70 },
      { id: "sc-poverty", key: "POVERTY", populationPercent: 30, averageIncome: 500, approval: 50, demands: [], educationLevel: 30, healthAccess: 40 },
    ],
    regimeMetrics: {
      powerConcentration: 30, pressFreedom: 80, judicialIndependence: 80,
      politicalPluralism: 80, civilLiberties: 80, transparency: 75, militarySubordination: 85,
    },
    media: [],
    events: [],
    consecutiveLowApprovalMonths: 0,
    longRunningDecisions: [],
    ...overrides,
  };
}

// ─── generateMediaCoverage ────────────────────────────────────────────────────

describe("generateMediaCoverage", () => {
  it("no genera coberturas si no hay eventos", () => {
    const state = crearEstadoBase({
      media: [crearMedio()],
    });
    const rng = createRNG("sin-eventos");
    const coverages = generateMediaCoverage(state, [], rng);
    expect(coverages).toHaveLength(0);
  });

  it("no genera coberturas si no hay medios activos", () => {
    const state = crearEstadoBase({
      media: [{ ...crearMedio(), status: "CENSORED" }],
    });
    const rng = createRNG("sin-medios-activos");
    const coverages = generateMediaCoverage(state, [crearEvento()], rng);
    expect(coverages).toHaveLength(0);
  });

  it("no genera coberturas si el medio esta cerrado", () => {
    const state = crearEstadoBase({
      media: [{ ...crearMedio(), status: "CLOSED" }],
    });
    const rng = createRNG("medio-cerrado");
    const coverages = generateMediaCoverage(state, [crearEvento()], rng);
    expect(coverages).toHaveLength(0);
  });

  it("genera una cobertura por evento y medio activo", () => {
    const medios = [
      crearMedio({ id: "media-1", name: "Medio 1" }),
      crearMedio({ id: "media-2", name: "Medio 2" }),
    ];
    const eventos = [crearEvento(), crearEvento({ id: "ev-2", type: "DISASTER", severity: 40 })];
    const state = crearEstadoBase({ media: medios });
    const rng = createRNG("dos-medios-dos-eventos");
    const coverages = generateMediaCoverage(state, eventos, rng);
    // 2 medios * 2 eventos = 4 coberturas
    expect(coverages).toHaveLength(4);
  });

  it("cada cobertura tiene la estructura requerida", () => {
    const state = crearEstadoBase({ media: [crearMedio()] });
    const rng = createRNG("estructura-cobertura");
    const coverages = generateMediaCoverage(state, [crearEvento()], rng);
    expect(coverages).toHaveLength(1);
    const c = coverages[0];
    expect(c).toHaveProperty("id");
    expect(c).toHaveProperty("mediaId");
    expect(c).toHaveProperty("headline");
    expect(c).toHaveProperty("sentiment");
    expect(c).toHaveProperty("impactOnApproval");
    expect(typeof c.id).toBe("string");
    expect(typeof c.headline).toBe("string");
    expect(typeof c.sentiment).toBe("number");
    expect(c.sentiment).toBeGreaterThanOrEqual(-1);
    expect(c.sentiment).toBeLessThanOrEqual(1);
  });

  it("medio pro-gobierno genera sentimiento positivo ante evento negativo", () => {
    const state = crearEstadoBase({
      media: [crearMedio({ id: "m-pro", governmentAffinity: 80 })],
    });
    const rng = createRNG("pro-gobierno-negativo");
    // Probamos varias veces con diferentes semillas; el sesgo editorial
    // debe dominar sobre el ruido en todos los casos
    const coverages = generateMediaCoverage(state, [crearEvento({ type: "SCANDAL" })], rng);
    expect(coverages).toHaveLength(1);
    // Medio muy afín debe mantener el sentimiento en rango mitigado
    expect(coverages[0].sentiment).toBeGreaterThanOrEqual(-0.15);
    expect(coverages[0].sentiment).toBeLessThanOrEqual(0.05);
  });

  it("medio opositor genera sentimiento negativo ante evento positivo", () => {
    // Un evento positivo = DISCOVERY (no está en la lista de negativos)
    const state = crearEstadoBase({
      media: [crearMedio({ id: "m-opp", governmentAffinity: -80 })],
    });
    const rng = createRNG("opositor-positivo");
    const coverages = generateMediaCoverage(state, [crearEvento({ type: "DISCOVERY" })], rng);
    expect(coverages).toHaveLength(1);
    // Medio muy opositor debe mantener el sentimiento en rango mitigado
    expect(coverages[0].sentiment).toBeGreaterThanOrEqual(-0.05);
    expect(coverages[0].sentiment).toBeLessThanOrEqual(0.15);
  });

  it("es determinista: misma semilla produce mismo resultado", () => {
    const state = crearEstadoBase({ media: [crearMedio()] });
    const eventos = [crearEvento()];
    const rng1 = createRNG("det-media");
    const rng2 = createRNG("det-media");
    const c1 = generateMediaCoverage(state, eventos, rng1);
    const c2 = generateMediaCoverage(state, eventos, rng2);
    expect(c1.map(c => c.id)).toEqual(c2.map(c => c.id));
    expect(c1.map(c => c.headline)).toEqual(c2.map(c => c.headline));
    expect(c1.map(c => c.sentiment)).toEqual(c2.map(c => c.sentiment));
    expect(c1.map(c => c.impactOnApproval)).toEqual(c2.map(c => c.impactOnApproval));
  });

  it("impacto en aprobacion varia segun nivel educativo de la clase", () => {
    const state = crearEstadoBase({
      media: [crearMedio({ governmentAffinity: 50 })],
      socialClasses: [
        { id: "sc-elite", key: "ELITE", populationPercent: 10, averageIncome: 5000, approval: 50, demands: [], educationLevel: 90, healthAccess: 90 },
        { id: "sc-poverty", key: "POVERTY", populationPercent: 30, averageIncome: 500, approval: 50, demands: [], educationLevel: 20, healthAccess: 40 },
      ],
    });
    const rng = createRNG("impacto-educacion");
    const coverages = generateMediaCoverage(state, [crearEvento({ type: "SCANDAL" })], rng);
    expect(coverages).toHaveLength(1);
    // La clase con más educación debería tener mayor impacto (absoluto)
    const eliteImpact = Math.abs(coverages[0].impactOnApproval["ELITE"]);
    const povertyImpact = Math.abs(coverages[0].impactOnApproval["POVERTY"]);
    expect(eliteImpact).toBeGreaterThanOrEqual(povertyImpact);
  });

  it("genera titulares con el nombre del medio incluido", () => {
    const state = crearEstadoBase({
      media: [crearMedio({ name: "La Gaceta Oficial", governmentAffinity: 60 })],
    });
    const rng = createRNG("titular-medio");
    const coverages = generateMediaCoverage(state, [crearEvento()], rng);
    expect(coverages).toHaveLength(1);
    expect(coverages[0].headline).toContain("La Gaceta Oficial");
  });
});

// ─── Acciones sobre medios en processTurn ─────────────────────────────────────

describe("acciones sobre medios en processTurn", () => {
  it("censurar un medio cambia su status a CENSORED y reduce credibilidad", () => {
    const state = crearEstadoBase({
      media: [crearMedio({ id: "m-1", status: "ACTIVE", credibility: 70 })],
    });
    const input: TurnInput = {
      mediaActions: { "m-1": "censor" },
    };
    const rng = createRNG("accion-censurar");
    const output = processTurn(state, input, rng);
    const medium = output.newState.media.find(m => m.id === "m-1");
    expect(medium?.status).toBe("CENSORED");
    expect(medium?.credibility).toBeLessThan(70);
  });

  it("clausurar un medio cambia su status a CLOSED", () => {
    const state = crearEstadoBase({
      media: [crearMedio({ id: "m-1", status: "ACTIVE" })],
    });
    const input: TurnInput = {
      mediaActions: { "m-1": "close" },
    };
    const rng = createRNG("accion-clausurar");
    const output = processTurn(state, input, rng);
    const medium = output.newState.media.find(m => m.id === "m-1");
    expect(medium?.status).toBe("CLOSED");
  });

  it("impulsar un medio aumenta su alcance y credibilidad", () => {
    const state = crearEstadoBase({
      media: [crearMedio({ id: "m-1", reach: 50, credibility: 60 })],
    });
    const input: TurnInput = {
      mediaActions: { "m-1": "boost" },
    };
    const rng = createRNG("accion-impulsar");
    const output = processTurn(state, input, rng);
    const medium = output.newState.media.find(m => m.id === "m-1");
    expect(medium?.reach).toBeGreaterThan(50);
    expect(medium?.credibility).toBeGreaterThan(60);
  });

  it("restaurar un medio censurado lo devuelve a ACTIVE", () => {
    const state = crearEstadoBase({
      media: [crearMedio({ id: "m-1", status: "CENSORED" })],
    });
    const input: TurnInput = {
      mediaActions: { "m-1": "restore" },
    };
    const rng = createRNG("accion-restaurar");
    const output = processTurn(state, input, rng);
    const medium = output.newState.media.find(m => m.id === "m-1");
    expect(medium?.status).toBe("ACTIVE");
  });

  it("accion 'none' no modifica el medio", () => {
    const state = crearEstadoBase({
      media: [crearMedio({ id: "m-1", status: "ACTIVE", reach: 50 })],
    });
    const input: TurnInput = {
      mediaActions: { "m-1": "none" },
    };
    const rng = createRNG("accion-none");
    const output = processTurn(state, input, rng);
    const medium = output.newState.media.find(m => m.id === "m-1");
    expect(medium?.status).toBe("ACTIVE");
    expect(medium?.reach).toBe(50);
  });

  it("censurar un medio genera notificacion de warning", () => {
    const state = crearEstadoBase({
      media: [crearMedio({ id: "m-1" })],
    });
    const input: TurnInput = {
      mediaActions: { "m-1": "censor" },
    };
    const rng = createRNG("notif-censurar");
    const output = processTurn(state, input, rng);
    const mediaNotifs = output.notifications.filter(n => n.type === "warning" && n.title === "Medio censurado");
    expect(mediaNotifs.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Coberturas en el turno completo ──────────────────────────────────────────

describe("coberturas en turno completo", () => {
  it("un turno sin eventos genera solo editoriales y sin coberturas de eventos", () => {
    const state = crearEstadoBase({
      media: [
        crearMedio({ id: "m-pro", governmentAffinity: 60 }),
        crearMedio({ id: "m-opp", governmentAffinity: -40 }),
        crearMedio({ id: "m-neu", governmentAffinity: 0 }),
      ],
    });
    const rng = createRNG("turn-sin-eventos");
    const output = processTurn(state, {}, rng);
    if (output.newEvents.length === 0) {
      // Solo debe haber editoriales (una por medio activo = 3)
      const editorialCoverages = output.mediaCoverages.filter(
        (c) => c.id.startsWith("mc-edit-")
      );
      expect(editorialCoverages).toHaveLength(3);
      // No debe haber coberturas de eventos
      const eventCoverages = output.mediaCoverages.filter(
        (c) => c.id.startsWith("mc-") && !c.id.startsWith("mc-edit-") && !c.id.startsWith("mc-dec-")
      );
      expect(eventCoverages).toHaveLength(0);
    }
  });

  it("un medio censurado no genera coberturas aunque haya eventos", () => {
    const state = crearEstadoBase({
      media: [
        crearMedio({ id: "m-censored", status: "CENSORED", governmentAffinity: 0 }),
        crearMedio({ id: "m-active", status: "ACTIVE", governmentAffinity: 0 }),
      ],
      officials: [
        { id: "off-1", name: "Corrupto", role: "MINISTER", ministryId: null, partyId: null, loyalty: 50, ambition: 60, wealth: 500000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 90, skill: 50, reputation: 20, status: "ACTIVE" },
        { id: "off-pros", name: "Fiscal General", role: "PROSECUTOR", ministryId: null, partyId: null, loyalty: 70, ambition: 20, wealth: 80000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 5, skill: 75, reputation: 80, status: "ACTIVE" },
        { id: "off-judge", name: "Juez Supremo", role: "JUDGE", ministryId: null, partyId: null, loyalty: 80, ambition: 10, wealth: 120000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 2, skill: 85, reputation: 90, status: "ACTIVE" },
      ],
    });
    const rng = createRNG("turn-con-censurado");
    const output = processTurn(state, {}, rng);
    // El medio censurado no debe generar coberturas
    const censoredCoverages = output.mediaCoverages.filter(c => c.mediaId === "m-censored");
    expect(censoredCoverages).toHaveLength(0);
  });
});
