// ─── Creación de snapshot mensual ────────────────────────────────────────────
// Captura el estado del país en un momento dado para guardar en la serie
// histórica. Funciones puras y deterministas.

import type { GameState, MonthSnapshotData } from "./types";
import { calculateApprovalByClass, calculateGeneralApproval } from "./approval";
import { calculateGlobalCorruption } from "./corruption";
import { classifyRegime } from "./regime";
import {
  calculatePoverty,
  calculateUnemployment,
  calculateHealthRegional,
  calculateFoodSecurity,
  calculateCrime,
  calculateEducation,
  calculateGini,
  calculateInflationSimple,
} from "./indicators";
import { calculateGDP } from "./economy";

/**
 * Crea un snapshot mensual del estado del país.
 * Recopila todos los indicadores calculados, aprobación, corrupción,
 * PIB y clasificación de régimen en un solo objeto para almacenar
 * en la serie histórica.
 *
 * @param state - Estado completo del juego después del procesamiento del turno
 * @param year - Año actual
 * @param month - Mes actual
 * @returns Snapshot con todos los indicadores y clasificaciones
 */
export function createMonthSnapshot(
  state: GameState,
  year: number,
  month: number
): MonthSnapshotData {
  // ── Eventos de este mes ────────────────────────────────────────────────
  const eventsThisMonth = state.events.filter(
    (e) => e.year === year && e.month === month
  );

  // ── Indicadores sociales (desde indicators.ts) ─────────────────────────
  const povertyRate = calculatePoverty(state);
  const unemploymentRate = calculateUnemployment(state);
  const sickRate = calculateHealthRegional(state);
  const foodSecurity = calculateFoodSecurity(state);
  const crimeRate = calculateCrime(state);
  const educationLevel = calculateEducation(state);
  const inflation = calculateInflationSimple(state);
  const gini = calculateGini(state, state.activeLaws);
  const gdp = calculateGDP(state);

  // ── Aprobación general ─────────────────────────────────────────────────
  const approval = calculateGeneralApproval(state, eventsThisMonth);

  // ── Corrupción global (promedio ponderado de funcionarios) ──────────────
  const corruption = calculateGlobalCorruption(state.officials);

  // ── Clasificación de régimen ───────────────────────────────────────────
  const regimeType = classifyRegime(
    state.regimeMetrics,
    crimeRate,
    corruption,
    approval
  );

  return {
    year,
    month,
    treasury: state.treasury,
    gdp,
    population: state.population,
    approval,
    corruption,
    povertyRate,
    unemploymentRate,
    sickRate,
    crimeRate,
    foodSecurity,
    educationLevel,
    inflation,
    gini,
    regimeType,
    regimeMetrics: { ...state.regimeMetrics },
    lifeExpectancy: state.lifeExpectancy,
    activeLrdCount: (state.longRunningDecisions ?? []).filter((d) => d.status === "IN_PROGRESS").length,
    lrdMonthlyCost: (state.longRunningDecisions ?? [])
      .filter((d) => d.status === "IN_PROGRESS")
      .reduce((sum, d) => sum + d.monthlyCost, 0),
    lrdCompletedThisMonth: (state.longRunningDecisions ?? []).filter((d) => {
      if (d.status !== "COMPLETED" || !d.completedAt) return false;
      const date = new Date(d.completedAt);
      return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month;
    }).length,
    lrdCancelledThisMonth: (state.longRunningDecisions ?? []).filter((d) => {
      if (d.status !== "CANCELLED" || !d.cancelledAt) return false;
      const date = new Date(d.cancelledAt);
      return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month;
    }).length,
    activeProgramsCount: (state.programs ?? []).filter((p) => p.status === "ACTIVE").length,
    programMonthlyCost: (state.programs ?? [])
      .filter((p) => p.status === "ACTIVE")
      .reduce((sum, p) => sum + p.monthlyCost, 0),
    diseasePrevalences: (state.diseases ?? []).map((d) => {
      const prev = state.diseasePrevalences.find((p) => p.diseaseId === d.id);
      return {
        diseaseId: d.id,
        name: d.name,
        category: d.category,
        prevalence: prev?.currentPrevalence ?? d.prevalenceBase,
      };
    }),
    tradeBalance: state.tradeBalance,
    totalImports: state.totalImports,
    totalExports: state.totalExports,
  };
}