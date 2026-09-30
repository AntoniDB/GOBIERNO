import { describe, it, expect } from "vitest";
import {
  calculatePoverty,
  calculateUnemployment,
  calculateHealth,
  calculateFoodSecurity,
  calculateCrime,
} from "@/lib/engine/indicators";
import type { GameState } from "@/lib/engine/types";

const DEFAULT_EFFICIENCY = 50;

function estado(claves: string[], eficiencia: Record<string, number>): GameState {
  const ministries = claves.map(k => ({
    id: `m-${k}`, key: k, budgetPercent: 10, internalCorruption: 5,
    subDecisions: {} as Record<string, number | boolean>,
    ministerOfficialId: null as string | null,
    efficiency: eficiencia[k] ?? DEFAULT_EFFICIENCY,
    producedResources: {} as Record<string, number>,
    consumedResources: {} as Record<string, number>,
    healthBudgetSplit: {} as Record<string, number>,
  }));
  return {
    countryName: "Test", currentYear: 2024, currentMonth: 1,
    treasury: 1000000, population: 10000000, seed: "verify",
    gdp: 50000000, povertyRate: 25, unemploymentRate: 8, sickRate: 5,
    crimeRate: 15, foodSecurity: 60, educationLevel: 50, inflation: 5,
    lifeExpectancy: 68,
    ministries, officials: [], parties: [], senators: [],
    activeLaws: [], judicialCases: [], organisms: [], socialClasses: [],
    regimeMetrics: { powerConcentration: 30, pressFreedom: 70, judicialIndependence: 60,
      politicalPluralism: 70, civilLiberties: 70, transparency: 50, militarySubordination: 60 },
    media: [], events: [],
    longRunningDecisions: [],
    consecutiveLowApprovalMonths: 0,
    programs: [],
    resourceStocks: [],
    regions: [],
    diseases: [],
    diseasePrevalences: [],
    diseaseMortality: 0,
    healthEfficiencyStreak: 0,
    consecutiveSaturationMonths: {},
    sanctionsMultiplier: 1,
    tradeGoods: [],
    tradeFlows: [],
    tradeBalance: 0,
    totalImports: 0,
    totalExports: 0,
  };
}

const EN = ["HEALTH", "EDUCATION", "ECONOMY", "DEFENSE", "SECURITY", "JUSTICE", "AGRICULTURE", "SOCIAL_DEVELOPMENT"];
const ES = ["salud", "educacion", "economia", "defensa", "seguridad", "justicia", "agricultura", "desarrollo_social"];

describe("Las 5 conexiones indicador←ministerio funcionan con ambas variantes de clave", () => {
  // Presupuesto mínimo (2%) → eficiencia ~2. Eficiencia baja = Ministerio en crisis
  // Default 50 = Ministerio no encontrado (bug previo) o eficiencia neutra.
  // La diferencia debe ser visible.
  const BAJA = 5;  // Simula presupuesto ≈ 2% con ministro skill 100: 2 * 1 * 1 * 1 = 2
  // pero usamos 5 para tener margen antes del clamp.

  // ─── Pobreza ← Desarrollo Social ─────────────────────────────────────────
  it("SOCIAL_DEVELOPMENT baja → sube pobreza (EN)", () => {
    const ref = calculatePoverty(estado(EN, { SOCIAL_DEVELOPMENT: DEFAULT_EFFICIENCY }));
    const baja = calculatePoverty(estado(EN, { SOCIAL_DEVELOPMENT: BAJA }));
    expect(baja).toBeGreaterThan(ref);
  });
  it("desarrollo_social baja → sube pobreza (ES)", () => {
    const ref = calculatePoverty(estado(ES, { desarrollo_social: DEFAULT_EFFICIENCY }));
    const baja = calculatePoverty(estado(ES, { desarrollo_social: BAJA }));
    expect(baja).toBeGreaterThan(ref);
  });

  // ─── Desempleo ← Economía ────────────────────────────────────────────────
  it("ECONOMY baja → sube desempleo (EN)", () => {
    const ref = calculateUnemployment(estado(EN, { ECONOMY: DEFAULT_EFFICIENCY }));
    const baja = calculateUnemployment(estado(EN, { ECONOMY: BAJA }));
    expect(baja).toBeGreaterThan(ref);
  });
  it("economia baja → sube desempleo (ES)", () => {
    const ref = calculateUnemployment(estado(ES, { economia: DEFAULT_EFFICIENCY }));
    const baja = calculateUnemployment(estado(ES, { economia: BAJA }));
    expect(baja).toBeGreaterThan(ref);
  });

  // ─── Enfermos ← Salud ────────────────────────────────────────────────────
  it("HEALTH baja → sube enfermos (EN)", () => {
    const ref = calculateHealth(estado(EN, { HEALTH: DEFAULT_EFFICIENCY }));
    const baja = calculateHealth(estado(EN, { HEALTH: BAJA }));
    expect(baja).toBeGreaterThan(ref);
  });
  it("salud baja → sube enfermos (ES)", () => {
    const ref = calculateHealth(estado(ES, { salud: DEFAULT_EFFICIENCY }));
    const baja = calculateHealth(estado(ES, { salud: BAJA }));
    expect(baja).toBeGreaterThan(ref);
  });

  // ─── Seguridad alimentaria ← Agricultura ─────────────────────────────────
  it("AGRICULTURE baja → cae seguridad alimentaria (EN)", () => {
    const ref = calculateFoodSecurity(estado(EN, { AGRICULTURE: DEFAULT_EFFICIENCY }));
    const baja = calculateFoodSecurity(estado(EN, { AGRICULTURE: BAJA }));
    expect(baja).toBeLessThan(ref);
  });
  it("agricultura baja → cae seguridad alimentaria (ES)", () => {
    const ref = calculateFoodSecurity(estado(ES, { agricultura: DEFAULT_EFFICIENCY }));
    const baja = calculateFoodSecurity(estado(ES, { agricultura: BAJA }));
    expect(baja).toBeLessThan(ref);
  });

  // ─── Crimen ← Seguridad ──────────────────────────────────────────────────
  it("SECURITY baja → sube crimen (EN)", () => {
    const ref = calculateCrime(estado(EN, { SECURITY: DEFAULT_EFFICIENCY }));
    const baja = calculateCrime(estado(EN, { SECURITY: BAJA }));
    expect(baja).toBeGreaterThan(ref);
  });
  it("seguridad baja → sube crimen (ES)", () => {
    const ref = calculateCrime(estado(ES, { seguridad: DEFAULT_EFFICIENCY }));
    const baja = calculateCrime(estado(ES, { seguridad: BAJA }));
    expect(baja).toBeGreaterThan(ref);
  });
});
