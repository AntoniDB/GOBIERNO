import { describe, it, expect } from "vitest";
import type { GameState, LawCatalogEntry } from "@/lib/engine/types";
import { BALANCE } from "@/lib/balance";
import { costScaleFactor, scaleCost, scaleLawCost } from "@/lib/engine/cost-scale";
import { LAW_CATALOG } from "@/lib/game-factory";
import { candidateHireCost } from "@/lib/engine/candidates";
import { defaultCostFor, createProgram } from "@/lib/engine/programs";
import {
  buildHospitalConstructionInput,
  buildMedicalResearchInput,
} from "@/lib/engine/long-running-decisions";
import { calculateIncome, calculateExpenses, lawCostProfile, resolveLawEnactments } from "@/lib/engine/economy";

const REF = BALANCE.COST_REFERENCE_POPULATION;

describe("scaleCost", () => {
  it("a la población de referencia el costo no cambia", () => {
    expect(costScaleFactor(REF)).toBe(1);
    expect(scaleCost(2_000_000, REF)).toBe(2_000_000);
  });

  it("escala linealmente con la población", () => {
    expect(scaleCost(2_000_000, 80_000_000)).toBe(16_000_000);
    expect(scaleCost(2_000_000, 5_000_000)).toBe(1_000_000);
  });

  it("redondea a dólares enteros", () => {
    expect(Number.isInteger(scaleCost(2_500_000, 33_333_333))).toBe(true);
  });

  it("mantiene constante el peso del costo respecto del ingreso mensual", () => {
    const peso = (population: number) =>
      scaleCost(BALANCE.PROGRAM_VACCINATION_COST, population) /
      calculateIncome({ population, activeLaws: [] } as unknown as GameState);
    expect(peso(80_000_000)).toBeCloseTo(peso(REF), 6);
    expect(peso(25_000_000)).toBeCloseTo(peso(REF), 6);
  });
});

describe("costos escalados en el motor", () => {
  it("defaultCostFor escala cada tipo de programa", () => {
    expect(defaultCostFor("VACCINATION_CAMPAIGN", 20_000_000)).toBe(BALANCE.PROGRAM_VACCINATION_COST * 2);
    expect(defaultCostFor("PREVENTION_EDUCATION", 20_000_000)).toBe(BALANCE.PROGRAM_PREVENTION_COST * 2);
    expect(defaultCostFor("MENTAL_HEALTH_PROGRAM", 20_000_000)).toBe(BALANCE.PROGRAM_MENTAL_HEALTH_COST * 2);
  });

  it("createProgram usa la población del estado si no se indica costo", () => {
    const state = { currentYear: 1, currentMonth: 1, population: 30_000_000 } as GameState;
    expect(createProgram(state, "PREVENTION_EDUCATION").monthlyCost).toBe(BALANCE.PROGRAM_PREVENTION_COST * 3);
  });

  it("un costo explícito no se reescala", () => {
    const state = { currentYear: 1, currentMonth: 1, population: 30_000_000 } as GameState;
    expect(createProgram(state, "PREVENTION_EDUCATION", {}, 123).monthlyCost).toBe(123);
  });

  it("hospitales e investigación escalan con la población", () => {
    expect(buildHospitalConstructionInput("r1", "tertiary", "X", 40_000_000).monthlyCost)
      .toBe(BALANCE.HOSPITAL_COSTS.tertiary * 4);
    expect(buildMedicalResearchInput(["d1"], ["VIH"], 40_000_000).monthlyCost)
      .toBe(BALANCE.MEDICAL_RESEARCH_COST * 4);
  });

  it("la duración de hospitales no depende de la población", () => {
    expect(buildHospitalConstructionInput("r1", "primary", "X", 80_000_000).totalMonths)
      .toBe(BALANCE.HOSPITAL_DURATIONS.primary);
  });

  it("candidateHireCost suma base + extra por rol y escala", () => {
    const base = BALANCE.CANDIDATE_HIRE_COST_BASE + 2 * BALANCE.CANDIDATE_HIRE_COST_PER_SAME_ROLE;
    expect(candidateHireCost(2, REF)).toBe(base);
    expect(candidateHireCost(2, 50_000_000)).toBe(base * 5);
  });
});

describe("costos de leyes y organismos (referencia 50M)", () => {
  const LAW_REF = BALANCE.LAW_COST_REFERENCE_POPULATION;

  function gastoConLey(population: number, monthlyCost: number): number {
    const base = {
      population, ministries: [], officials: [], organisms: [],
      activeLaws: [] as { id: string; lawKey: string; activatedAt: string; effectsJson: Record<string, unknown> }[],
    };
    const con = { ...base, activeLaws: [{ id: "l1", lawKey: "x", activatedAt: "", effectsJson: { monthlyCost } }] };
    return calculateExpenses(con as unknown as GameState) - calculateExpenses(base as unknown as GameState);
  }

  it("scaleLawCost no cambia el costo a la población de referencia de leyes", () => {
    expect(scaleLawCost(400_000_000, LAW_REF)).toBe(400_000_000);
  });

  it("scaleLawCost usa una referencia distinta a la de programas", () => {
    expect(scaleLawCost(400_000_000, 10_000_000)).toBe(80_000_000);
    expect(scaleCost(400_000_000, 10_000_000)).toBe(400_000_000);
  });

  it.each([10_000_000, 25_000_000, LAW_REF, 80_000_000])(
    "calculateExpenses cobra el monthlyCost de una ley escalado (pob. %i)",
    (population) => {
      expect(gastoConLey(population, 400_000_000)).toBe(scaleLawCost(400_000_000, population));
    },
  );

  it("el peso de una ley respecto del ingreso mensual es el mismo en cualquier país", () => {
    const peso = (population: number) =>
      gastoConLey(population, 800_000_000) /
      calculateIncome({ population, activeLaws: [] } as unknown as GameState);
    expect(peso(80_000_000)).toBeCloseTo(peso(25_000_000), 6);
    expect(peso(10_000_000)).toBeCloseTo(peso(LAW_REF), 6);
  });

  it("ninguna ley del catálogo supera el 50% del ingreso mensual a la población de referencia", () => {
    const ingreso = calculateIncome({ population: LAW_REF, activeLaws: [] } as unknown as GameState);
    const costos = LAW_CATALOG
      .map((l) => (l.effectsJson as Record<string, unknown>).monthlyCost)
      .filter((c): c is number => typeof c === "number");
    expect(costos.length).toBeGreaterThan(0);
    for (const c of costos) expect(c / ingreso).toBeLessThanOrEqual(0.5);
  });
});

describe("costo único de promulgar leyes", () => {
  const LAW_REF = BALANCE.LAW_COST_REFERENCE_POPULATION;
  const entry = (key: string): LawCatalogEntry => {
    const l = LAW_CATALOG.find((x) => x.key === key)!;
    return { key: l.key, name: l.name, description: l.description, effectsJson: l.effectsJson as Record<string, unknown>, idealIdeology: l.idealIdeology, cost: l.cost };
  };
  const catalog = new Map(LAW_CATALOG.map((l) => [l.key, entry(l.key)]));

  it("una ley con costo mensual no tiene costo único (su cost repite el monto mensual)", () => {
    const p = lawCostProfile(entry("reforma-policial"), LAW_REF);
    expect(p.monthly).toBe(400_000_000);
    expect(p.enactment).toBe(0);
  });

  it("una ley sin costo mensual paga su cost una sola vez, escalado", () => {
    expect(lawCostProfile(entry("subsidio-alimentario"), LAW_REF)).toEqual({ monthly: 0, enactment: 500_000_000 });
    expect(lawCostProfile(entry("subsidio-alimentario"), 80_000_000).enactment).toBe(800_000_000);
  });

  it("un cost negativo es un ingreso único", () => {
    expect(lawCostProfile(entry("privatizacion-empresas"), LAW_REF).enactment).toBe(-2_000_000_000);
  });

  it("una ley sin costo no cobra nada", () => {
    expect(lawCostProfile(entry("impuesto-progresivo"), LAW_REF)).toEqual({ monthly: 0, enactment: 0 });
  });

  it("en todo el catálogo, si hay costo mensual el cost lo repite (si no, se perdería información)", () => {
    for (const l of LAW_CATALOG) {
      const monthly = (l.effectsJson as Record<string, unknown>).monthlyCost;
      if (typeof monthly === "number") expect(l.cost, l.key).toBe(monthly);
    }
  });

  it("resolveLawEnactments suma gastos e ingresos y detalla solo las leyes con costo único", () => {
    const r = resolveLawEnactments(
      ["subsidio-alimentario", "privatizacion-empresas", "reforma-policial", "impuesto-progresivo"],
      catalog, LAW_REF,
    );
    expect(r.details.map((d) => d.lawKey)).toEqual(["subsidio-alimentario", "privatizacion-empresas"]);
    expect(r.totalCost).toBe(500_000_000 - 2_000_000_000);
  });

  it("ignora claves que no están en el catálogo y devuelve 0 sin leyes", () => {
    expect(resolveLawEnactments(["no-existe"], catalog, LAW_REF)).toEqual({ totalCost: 0, details: [] });
    expect(resolveLawEnactments([], catalog, LAW_REF)).toEqual({ totalCost: 0, details: [] });
  });

  it("el costo único pesa lo mismo respecto del ingreso mensual en cualquier país", () => {
    const peso = (population: number) =>
      lawCostProfile(entry("salud-universal"), population).enactment /
      calculateIncome({ population, activeLaws: [] } as unknown as GameState);
    expect(peso(25_000_000)).toBeCloseTo(peso(80_000_000), 6);
  });
});
