import { describe, it, expect } from "vitest";
import type { GameState } from "@/lib/engine/types";
import { BALANCE } from "@/lib/balance";
import { costScaleFactor, scaleCost } from "@/lib/engine/cost-scale";
import { candidateHireCost } from "@/lib/engine/candidates";
import { defaultCostFor, createProgram } from "@/lib/engine/programs";
import {
  buildHospitalConstructionInput,
  buildMedicalResearchInput,
} from "@/lib/engine/long-running-decisions";
import { calculateIncome } from "@/lib/engine/economy";

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
