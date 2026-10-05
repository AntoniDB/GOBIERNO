import { describe, it, expect } from "vitest";
import type { GameState, TurnInput, MinistryProgramState, DiseaseStateInput } from "@/lib/engine/types";
import {
  createProgram,
  createNewPrograms,
  advancePrograms,
  applyMentalHealthApprovalBonus,
  defaultCostFor,
  getVaccineDiseases,
  getMentalHealthDiseases,
  programLabel,
  isDiseaseCovered,
} from "@/lib/engine/programs";
import { BALANCE } from "@/lib/balance";
import { diseaseTargetPrevalence } from "@/lib/engine/diseases";

function crearEstadoBase(overrides?: Partial<GameState>): GameState {
  return {
    healthEfficiencyStreak: 0,
    consecutiveSaturationMonths: {},
    countryName: "Test",
    currentYear: 2024,
    currentMonth: 1,
    treasury: 1_000_000_000,
    population: 10_000_000,
    seed: "test",
    gdp: 30_000_000_000,
    povertyRate: 25,
    unemploymentRate: 8,
    sickRate: 5,
    crimeRate: 15,
    foodSecurity: 60,
    educationLevel: 50,
    inflation: 5,
    lifeExpectancy: 68,
    ministries: [],
    officials: [],
    parties: [],
    senators: [],
    activeLaws: [],
    judicialCases: [],
    organisms: [],
    socialClasses: [
      { id: "sc1", key: "EXTREME_POVERTY", populationPercent: 20, averageIncome: 0, approval: 50, demands: [], educationLevel: 30, healthAccess: 50 },
      { id: "sc2", key: "POVERTY", populationPercent: 40, averageIncome: 0, approval: 50, demands: [], educationLevel: 40, healthAccess: 60 },
      { id: "sc3", key: "MIDDLE", populationPercent: 30, averageIncome: 0, approval: 50, demands: [], educationLevel: 60, healthAccess: 70 },
      { id: "sc4", key: "ELITE", populationPercent: 10, averageIncome: 0, approval: 50, demands: [], educationLevel: 80, healthAccess: 90 },
    ],
    regimeMetrics: {
      powerConcentration: 30, pressFreedom: 70, judicialIndependence: 60,
      politicalPluralism: 70, civilLiberties: 70, transparency: 50, militarySubordination: 60,
    },
    media: [],
    events: [],
    longRunningDecisions: [],
    programs: [],
    resourceStocks: [],
    regions: [],
    diseases: [],
    diseasePrevalences: [],
    diseaseMortality: 0,
    consecutiveLowApprovalMonths: 0,
    sanctionsMultiplier: 1,
    tradeGoods: [],
    tradeFlows: [],
    tradeBalance: 0,
    totalImports: 0,
    totalExports: 0,
    ...overrides,
  };
}

function crearDisease(overrides?: Partial<DiseaseStateInput>): DiseaseStateInput {
  return {
    id: "d-gripe",
    name: "Gripe estacional",
    category: "TRANSMISSIBLE",
    contagionRate: 0.15,
    mortalityRate: 0.001,
    prevalence: 0,
    prevalenceBase: 10,
    hasVaccine: true,
    preventionSensitivity: 0.8,
    monthlyCostPerPatient: 200,
    classAffinity: { EXTREME_POVERTY: 1.0, POVERTY: 1.0, MIDDLE: 1.0, ELITE: 1.0 },
    ...overrides,
  };
}

/** Equilibrio con la eficiencia de Salud por defecto del motor cuando no hay ministerio (50). */
const equilibrio = (d: DiseaseStateInput) => diseaseTargetPrevalence(d, 50);

function crearPrograma(overrides?: Partial<MinistryProgramState>): MinistryProgramState {
  return {
    id: "prog-1",
    type: "VACCINATION_CAMPAIGN",
    parameters: { diseaseId: "d-gripe", diseaseName: "Gripe estacional" },
    monthlyCost: BALANCE.PROGRAM_VACCINATION_COST,
    status: "ACTIVE",
    startedAt: "2024-01-01T00:00:00.000Z",
    deactivatedAt: null,
    ...overrides,
  };
}

describe("defaultCostFor", () => {
  it("retorna el costo correcto para cada tipo de programa", () => {
    expect(defaultCostFor("VACCINATION_CAMPAIGN", BALANCE.COST_REFERENCE_POPULATION)).toBe(BALANCE.PROGRAM_VACCINATION_COST);
    expect(defaultCostFor("PREVENTION_EDUCATION", BALANCE.COST_REFERENCE_POPULATION)).toBe(BALANCE.PROGRAM_PREVENTION_COST);
    expect(defaultCostFor("MENTAL_HEALTH_PROGRAM", BALANCE.COST_REFERENCE_POPULATION)).toBe(BALANCE.PROGRAM_MENTAL_HEALTH_COST);
  });
});

describe("getVaccineDiseases / getMentalHealthDiseases", () => {
  it("filtra solo las enfermedades con hasVaccine=true", () => {
    const state = crearEstadoBase({
      diseases: [
        crearDisease({ id: "d1", hasVaccine: true }),
        crearDisease({ id: "d2", hasVaccine: false }),
        crearDisease({ id: "d3", hasVaccine: true }),
      ],
    });
    const vac = getVaccineDiseases(state);
    expect(vac).toHaveLength(2);
    expect(vac[0].id).toBe("d1");
    expect(vac[1].id).toBe("d3");
  });

  it("filtra solo las enfermedades de salud mental", () => {
    const state = crearEstadoBase({
      diseases: [
        crearDisease({ id: "d1", category: "TRANSMISSIBLE" }),
        crearDisease({ id: "d2", category: "MENTAL_HEALTH" }),
        crearDisease({ id: "d3", category: "CHRONIC" }),
      ],
    });
    const mental = getMentalHealthDiseases(state);
    expect(mental).toHaveLength(1);
    expect(mental[0].id).toBe("d2");
  });
});

describe("createProgram / createNewPrograms", () => {
  it("crea un programa con ID unico y costo por defecto", () => {
    const state = crearEstadoBase();
    const prog = createProgram(state, "PREVENTION_EDUCATION");
    expect(prog.id).toBe("prog-2024-1-0");
    expect(prog.type).toBe("PREVENTION_EDUCATION");
    expect(prog.monthlyCost).toBe(BALANCE.PROGRAM_PREVENTION_COST);
    expect(prog.status).toBe("ACTIVE");
    expect(prog.startedAt).toBeDefined();
  });

  it("crea programas desde el input del jugador con el costo del motor", () => {
    const state = crearEstadoBase();
    const input: TurnInput = {
      newPrograms: [
        { type: "PREVENTION_EDUCATION" },
        { type: "MENTAL_HEALTH_PROGRAM" },
      ],
    };
    const { programs, rejections } = createNewPrograms(state, input);
    expect(rejections).toEqual([]);
    expect(programs).toHaveLength(2);
    expect(programs[0].id).toBe("prog-2024-1-0");
    expect(programs[1].id).toBe("prog-2024-1-1");
    expect(programs[1].monthlyCost).toBe(BALANCE.PROGRAM_MENTAL_HEALTH_COST);
  });

  it("ignora el costo y los parámetros extra que envíe el cliente", () => {
    const state = crearEstadoBase();
    const input = {
      newPrograms: [{ type: "PREVENTION_EDUCATION", monthlyCost: -9_999_999_999, parameters: { cualquier: "cosa" } }],
    } as unknown as TurnInput;
    const { programs } = createNewPrograms(state, input);
    expect(programs[0].monthlyCost).toBe(BALANCE.PROGRAM_PREVENTION_COST);
    expect(programs[0].parameters).toEqual({});
  });

  it("la campaña de vacunación toma el nombre de la enfermedad del estado", () => {
    const state = crearEstadoBase({ diseases: [crearDisease()] });
    const { programs } = createNewPrograms(state, {
      newPrograms: [{ type: "VACCINATION_CAMPAIGN", parameters: { diseaseId: "d-gripe", diseaseName: "Falso" } }],
    });
    expect(programs[0].parameters).toEqual({ diseaseId: "d-gripe", diseaseName: "Gripe estacional" });
    expect(programs[0].monthlyCost).toBe(BALANCE.PROGRAM_VACCINATION_COST);
  });

  it.each([
    ["vacunación sin enfermedad", { type: "VACCINATION_CAMPAIGN" }],
    ["vacunación de una enfermedad inexistente", { type: "VACCINATION_CAMPAIGN", parameters: { diseaseId: "nope" } }],
    ["vacunación de una enfermedad sin vacuna", { type: "VACCINATION_CAMPAIGN", parameters: { diseaseId: "d-sin" } }],
    ["tipo desconocido", { type: "PROGRAMA_GRATIS" }],
    ["tipo heredado de Object", { type: "constructor" }],
    ["sin tipo", {}],
  ])("rechaza: %s", (_nombre, request) => {
    const state = crearEstadoBase({ diseases: [crearDisease(), crearDisease({ id: "d-sin", hasVaccine: false })] });
    const { programs, rejections } = createNewPrograms(state, { newPrograms: [request as never] });
    expect(programs).toEqual([]);
    expect(rejections).toHaveLength(1);
    expect(rejections[0]).toContain("Programa rechazado");
  });

  it("devuelve vacío si no hay newPrograms", () => {
    const state = crearEstadoBase();
    expect(createNewPrograms(state, {})).toEqual({ programs: [], rejections: [] });
  });
});

describe("advancePrograms", () => {
  it("descuenta monthlyCost del tesoro por cada programa activo", () => {
    const state = crearEstadoBase({
      treasury: 1_000_000_000,
      diseases: [crearDisease()],
      diseasePrevalences: [{ id: "p1", diseaseId: "d-gripe", currentPrevalence: 10 }],
      programs: [crearPrograma()],
    });
    const result = advancePrograms(state, {});
    expect(result.totalCost).toBe(BALANCE.PROGRAM_VACCINATION_COST);
    expect(result.cancelled).toHaveLength(0);
  });

  it("cancela programas indicados por el jugador (sin descontar costo del mes)", () => {
    const state = crearEstadoBase({
      diseases: [crearDisease()],
      diseasePrevalences: [{ id: "p1", diseaseId: "d-gripe", currentPrevalence: 10 }],
      programs: [crearPrograma({ id: "prog-cancel" })],
    });
    const input: TurnInput = { cancelProgramIds: ["prog-cancel"] };
    const result = advancePrograms(state, input);
    expect(result.updatedPrograms[0].status).toBe("CANCELLED");
    expect(result.cancelled).toHaveLength(1);
    // El costo del mes en que se cancela NO se descuenta
    expect(result.totalCost).toBe(0);
  });

  it("no avanza programas ya CANCELLED o COMPLETED", () => {
    const state = crearEstadoBase({
      programs: [
        crearPrograma({ id: "p-c", status: "CANCELLED", deactivatedAt: "2024-01-01" }),
        crearPrograma({ id: "p-d", status: "COMPLETED", deactivatedAt: "2024-01-01" }),
      ],
    });
    const result = advancePrograms(state, {});
    expect(result.totalCost).toBe(0);
    expect(result.updatedPrograms[0].status).toBe("CANCELLED");
    expect(result.updatedPrograms[1].status).toBe("COMPLETED");
  });
});

describe("reduccion de prevalencia (efecto por mes)", () => {
  it("campana de vacunacion reduce la prevalencia hacia el minimo (10% de base)", () => {
    const state = crearEstadoBase({
      diseases: [crearDisease({ prevalenceBase: 10 })],
      diseasePrevalences: [{ id: "p1", diseaseId: "d-gripe", currentPrevalence: 10 }],
      programs: [crearPrograma({ type: "VACCINATION_CAMPAIGN", parameters: { diseaseId: "d-gripe", diseaseName: "Gripe" } })],
    });
    // Mes 1: 10 - 0.8 = 9.2
    advancePrograms(state, {});
    expect(state.diseasePrevalences[0].currentPrevalence).toBeCloseTo(9.2, 1);

    // Sostenido varios meses deberia acercarse al minimo (10 * 0.10 = 1)
    for (let i = 0; i < 30; i++) advancePrograms(state, {});
    expect(state.diseasePrevalences[0].currentPrevalence).toBeLessThanOrEqual(2);
  });

  it("prevencion reduce transmisible y cronico pero no mentales", () => {
    const trans = crearDisease({ id: "d-tr", name: "Trans", category: "TRANSMISSIBLE", prevalenceBase: 10 });
    const cron = crearDisease({ id: "d-cr", name: "Cron", category: "CHRONIC", prevalenceBase: 8, hasVaccine: false });
    const mental = crearDisease({ id: "d-me", name: "Mental", category: "MENTAL_HEALTH", prevalenceBase: 5, hasVaccine: false });
    const state = crearEstadoBase({
      diseases: [trans, cron, mental],
      // Todas parten de su equilibrio: lo que se mueva es efecto del programa
      diseasePrevalences: [
        { id: "p1", diseaseId: "d-tr", currentPrevalence: equilibrio(trans) },
        { id: "p2", diseaseId: "d-cr", currentPrevalence: equilibrio(cron) },
        { id: "p3", diseaseId: "d-me", currentPrevalence: equilibrio(mental) },
      ],
      programs: [crearPrograma({
        id: "p-prev", type: "PREVENTION_EDUCATION", parameters: {}, monthlyCost: BALANCE.PROGRAM_PREVENTION_COST,
      })],
    });
    advancePrograms(state, {});
    expect(state.diseasePrevalences[0].currentPrevalence).toBeCloseTo(equilibrio(trans) - BALANCE.PREVENTION_PREVALENCE_DECAY, 1);
    expect(state.diseasePrevalences[1].currentPrevalence).toBeCloseTo(equilibrio(cron) - BALANCE.PREVENTION_PREVALENCE_DECAY, 1);
    // Mental NO debe bajar (se queda en su equilibrio)
    expect(state.diseasePrevalences[2].currentPrevalence).toBeCloseTo(equilibrio(mental), 2);
  });

  it("la prevencion todavia reduce con buena gestion de Salud (minimo medido sobre el equilibrio)", () => {
    const trans = crearDisease({ id: "d-tr", prevalenceBase: 10 });
    const eficiencia = 90;
    const eq = diseaseTargetPrevalence(trans, eficiencia);
    const state = crearEstadoBase({
      ministries: [{ key: "HEALTH", efficiency: eficiencia }] as unknown as GameState["ministries"],
      diseases: [trans],
      diseasePrevalences: [{ id: "p1", diseaseId: "d-tr", currentPrevalence: eq }],
      programs: [crearPrograma({
        id: "p-prev", type: "PREVENTION_EDUCATION", parameters: {}, monthlyCost: BALANCE.PROGRAM_PREVENTION_COST,
      })],
    });
    for (let i = 0; i < 60; i++) advancePrograms(state, {});
    // Llega al minimo del programa: PREVENTION_MIN_RATIO × equilibrio (< equilibrio)
    expect(state.diseasePrevalences[0].currentPrevalence).toBeCloseTo(eq * BALANCE.PREVENTION_MIN_RATIO, 1);
    expect(state.diseasePrevalences[0].currentPrevalence).toBeLessThan(eq);
  });

  it("salud mental reduce depresion, ansiedad y adicciones", () => {
    const dep = crearDisease({ id: "d-dep", name: "Depresion", category: "MENTAL_HEALTH", prevalenceBase: 12, hasVaccine: false });
    const ans = crearDisease({ id: "d-ans", name: "Ansiedad", category: "MENTAL_HEALTH", prevalenceBase: 10, hasVaccine: false });
    const adi = crearDisease({ id: "d-adi", name: "Adicciones", category: "MENTAL_HEALTH", prevalenceBase: 5, hasVaccine: false });
    const gripe = crearDisease({ id: "d-tr", name: "Gripe", category: "TRANSMISSIBLE", prevalenceBase: 10, hasVaccine: true });
    const state = crearEstadoBase({
      diseases: [dep, ans, adi, gripe],
      diseasePrevalences: [dep, ans, adi, gripe].map((d, i) => ({
        id: `p${i + 1}`, diseaseId: d.id, currentPrevalence: equilibrio(d),
      })),
      programs: [crearPrograma({
        id: "p-mental", type: "MENTAL_HEALTH_PROGRAM", parameters: {}, monthlyCost: BALANCE.PROGRAM_MENTAL_HEALTH_COST,
      })],
    });
    advancePrograms(state, {});
    expect(state.diseasePrevalences[0].currentPrevalence).toBeCloseTo(equilibrio(dep) - BALANCE.MENTAL_HEALTH_PREVALENCE_DECAY, 1);
    expect(state.diseasePrevalences[1].currentPrevalence).toBeCloseTo(equilibrio(ans) - BALANCE.MENTAL_HEALTH_PREVALENCE_DECAY, 1);
    expect(state.diseasePrevalences[2].currentPrevalence).toBeCloseTo(equilibrio(adi) - BALANCE.MENTAL_HEALTH_PREVALENCE_DECAY, 1);
    // Transmisible no cubierta: se queda en su equilibrio
    expect(state.diseasePrevalences[3].currentPrevalence).toBeCloseTo(equilibrio(gripe), 2);
  });
});

describe("recuperacion al desactivar", () => {
  it("al desactivar el programa, la prevalencia sube lentamente hacia el equilibrio", () => {
    const state = crearEstadoBase({
      diseases: [crearDisease({ prevalenceBase: 10 })],
      // La prevalencia esta muy baja (efecto de campaña sostenida previa)
      diseasePrevalences: [{ id: "p1", diseaseId: "d-gripe", currentPrevalence: 2 }],
      // Sin programas activos
      programs: [],
    });
    advancePrograms(state, {});
    // 2 + 0.4 (VACCINATION_RECOVERY_RATE porque es transmisible con vacuna) = 2.4
    expect(state.diseasePrevalences[0].currentPrevalence).toBeCloseTo(2.4, 1);
  });

  it("la recuperacion no pasa del equilibrio (base con prevencion + contagio)", () => {
    const gripe = crearDisease({ prevalenceBase: 10 });
    const eq = equilibrio(gripe); // 10×(1−0.5×0.8) + 0.15×0.5×5 = 6.375
    expect(eq).toBeCloseTo(6.375, 3);
    const state = crearEstadoBase({
      diseases: [gripe],
      diseasePrevalences: [{ id: "p1", diseaseId: "d-gripe", currentPrevalence: eq - 0.1 }],
      programs: [],
    });
    advancePrograms(state, {});
    expect(state.diseasePrevalences[0].currentPrevalence).toBeCloseTo(eq, 3);
  });

  it("sin programas la prevalencia sembrada en equilibrio no se mueve (sin rampa)", () => {
    const diseases = [
      crearDisease({ id: "d-a", prevalenceBase: 10 }),
      crearDisease({ id: "d-b", category: "CHRONIC", prevalenceBase: 14, hasVaccine: false, preventionSensitivity: 0.5 }),
      crearDisease({ id: "d-c", category: "MENTAL_HEALTH", prevalenceBase: 12, hasVaccine: false, preventionSensitivity: 0.5 }),
    ];
    const state = crearEstadoBase({
      diseases,
      diseasePrevalences: diseases.map((d) => ({ id: `p-${d.id}`, diseaseId: d.id, currentPrevalence: equilibrio(d) })),
      programs: [],
    });
    for (let i = 0; i < 24; i++) advancePrograms(state, {});
    diseases.forEach((d, i) => expect(state.diseasePrevalences[i].currentPrevalence).toBeCloseTo(equilibrio(d), 2));
  });

  it("subir la eficiencia de Salud baja la prevalencia; bajarla la sube", () => {
    const hipertension = crearDisease({ id: "d-h", category: "CHRONIC", prevalenceBase: 14, hasVaccine: false, preventionSensitivity: 0.5 });
    const correr = (eficiencia: number) => {
      const state = crearEstadoBase({
        ministries: [{ key: "HEALTH", efficiency: eficiencia }] as unknown as GameState["ministries"],
        diseases: [hipertension],
        diseasePrevalences: [{ id: "p1", diseaseId: "d-h", currentPrevalence: equilibrio(hipertension) }],
        programs: [],
      });
      for (let i = 0; i < 24; i++) advancePrograms(state, {});
      return state.diseasePrevalences[0].currentPrevalence;
    };
    expect(correr(90)).toBeLessThan(equilibrio(hipertension));
    expect(correr(10)).toBeGreaterThan(equilibrio(hipertension));
  });
});

describe("applyMentalHealthApprovalBonus", () => {
  it("otorga +3 POVERTY y +2 MIDDLE mientras el programa de salud mental este activo", () => {
    const state = crearEstadoBase();
    const povertyBefore = state.socialClasses.find((s) => s.key === "POVERTY")!.approval;
    const middleBefore = state.socialClasses.find((s) => s.key === "MIDDLE")!.approval;
    const eliteBefore = state.socialClasses.find((s) => s.key === "ELITE")!.approval;

    applyMentalHealthApprovalBonus(state, [
      crearPrograma({ id: "p-mh", type: "MENTAL_HEALTH_PROGRAM", parameters: {} }),
    ]);

    expect(state.socialClasses.find((s) => s.key === "POVERTY")!.approval).toBe(povertyBefore + 3);
    expect(state.socialClasses.find((s) => s.key === "MIDDLE")!.approval).toBe(middleBefore + 2);
    // ELITE no recibe bonus
    expect(state.socialClasses.find((s) => s.key === "ELITE")!.approval).toBe(eliteBefore);
  });

  it("no aplica bonus si no hay programa de salud mental activo", () => {
    const state = crearEstadoBase();
    const before = state.socialClasses.find((s) => s.key === "POVERTY")!.approval;
    applyMentalHealthApprovalBonus(state, [
      crearPrograma({ id: "p-prev", type: "PREVENTION_EDUCATION", parameters: {} }),
    ]);
    expect(state.socialClasses.find((s) => s.key === "POVERTY")!.approval).toBe(before);
  });

  it("aplica el bonus correctamente y respeta el clamp de [0, 100]", () => {
    const state = crearEstadoBase({
      socialClasses: [
        { id: "sc1", key: "POVERTY", populationPercent: 50, averageIncome: 0, approval: 99, demands: [], educationLevel: 40, healthAccess: 60 },
      ],
    });
    applyMentalHealthApprovalBonus(state, [
      crearPrograma({ id: "p-mh", type: "MENTAL_HEALTH_PROGRAM", parameters: {} }),
    ]);
    // 99 + 3 = 102 -> clamp a 100
    expect(state.socialClasses[0].approval).toBe(100);
  });
});

describe("programLabel", () => {
  it("genera un label legible para cada tipo", () => {
    expect(programLabel(crearPrograma({ type: "VACCINATION_CAMPAIGN", parameters: { diseaseName: "Gripe" } }))).toContain("Campaña de vacunación");
    expect(programLabel(crearPrograma({ type: "PREVENTION_EDUCATION", parameters: {} }))).toContain("prevención");
    expect(programLabel(crearPrograma({ type: "MENTAL_HEALTH_PROGRAM", parameters: {} }))).toContain("salud mental");
  });
});

describe("flujo completo: activar -> varios meses -> desactivar", () => {
  it("activar campaa 12 meses baja prevalencia significativamente, desactivar la hace subir", () => {
    const state = crearEstadoBase({
      diseases: [crearDisease({ prevalenceBase: 10 })],
      diseasePrevalences: [{ id: "p1", diseaseId: "d-gripe", currentPrevalence: 10 }],
      programs: [crearPrograma({ type: "VACCINATION_CAMPAIGN" })],
    });

    // 12 meses de campaña activa (simula orquestador que persiste updatedPrograms)
    for (let i = 0; i < 12; i++) {
      const r = advancePrograms(state, {});
      state.programs = r.updatedPrograms;
    }
    const prevTrasSostenido = state.diseasePrevalences[0].currentPrevalence;
    expect(prevTrasSostenido).toBeLessThan(5); // baja sustancialmente

    // Desactivar
    const r = advancePrograms(state, { cancelProgramIds: [state.programs[0].id] });
    state.programs = r.updatedPrograms;
    expect(state.programs[0].status).toBe("CANCELLED");

    // 12 meses sin programa activo: la prevalencia sube
    for (let i = 0; i < 12; i++) {
      const rr = advancePrograms(state, {});
      state.programs = rr.updatedPrograms;
    }
    const prevTrasRecuperar = state.diseasePrevalences[0].currentPrevalence;
    expect(prevTrasRecuperar).toBeGreaterThan(prevTrasSostenido);
    expect(prevTrasRecuperar).toBeLessThanOrEqual(10);
  });
});
describe("isDiseaseCovered", () => {
  const gripe = { id: "d-gripe", category: "TRANSMISSIBLE", hasVaccine: true };
  const dengue = { id: "d-dengue", category: "TRANSMISSIBLE", hasVaccine: false };
  const hipertension = { id: "d-hta", category: "CHRONIC", hasVaccine: false };
  const depresion = { id: "d-dep", category: "MENTAL_HEALTH", hasVaccine: false };
  const prog = (type: string, parameters: Record<string, unknown> = {}) => ({ type, parameters }) as MinistryProgramState;

  it("sin programas nada está cubierto", () => {
    for (const d of [gripe, dengue, hipertension, depresion]) expect(isDiseaseCovered(d, [])).toBe(false);
  });
  it("la campaña de vacunación cubre solo la enfermedad elegida", () => {
    const campana = [prog("VACCINATION_CAMPAIGN", { diseaseId: "d-gripe" })];
    expect(isDiseaseCovered(gripe, campana)).toBe(true);
    expect(isDiseaseCovered({ ...gripe, id: "otra" }, campana)).toBe(false);
    expect(isDiseaseCovered(dengue, campana)).toBe(false);
  });
  it("la prevención cubre transmisibles y crónicas, no mentales", () => {
    const prevencion = [prog("PREVENTION_EDUCATION")];
    expect(isDiseaseCovered(gripe, prevencion)).toBe(true);
    expect(isDiseaseCovered(dengue, prevencion)).toBe(true);
    expect(isDiseaseCovered(hipertension, prevencion)).toBe(true);
    expect(isDiseaseCovered(depresion, prevencion)).toBe(false);
  });
  it("el programa de salud mental cubre solo las mentales", () => {
    const mental = [prog("MENTAL_HEALTH_PROGRAM")];
    expect(isDiseaseCovered(depresion, mental)).toBe(true);
    expect(isDiseaseCovered(gripe, mental)).toBe(false);
    expect(isDiseaseCovered(hipertension, mental)).toBe(false);
  });
});
