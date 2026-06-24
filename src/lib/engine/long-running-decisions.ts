// ─── Sistema generico de decisiones de varios meses (Long-Running Decisions) ──
// Permite que el jugador inicie decisiones que tardan N meses en completarse.
// Cada mes se descuenta monthlyCost del tesoro y se avanza el contador.
// Al llegar a monthsRemaining = 0 se dispara effectOnCompletion.
// El jugador puede cancelar antes de tiempo (pierde lo invertido).
//
// Los efectos concretos de cada tipo de decision se definen en la fase de
// profundizacion de cada ministerio (ej: Salud-3 para hospitales).
// Esta infraestructura es generica y reutilizable.

import type { GameState, LongRunningDecisionState, TurnInput } from "./types";
import { BALANCE } from "../balance";

/**
 * Avanza todas las LRD activas un mes:
 * - Decrementa monthsRemaining
 * - Descuenta monthlyCost del tesoro
 * - Marca COMPLETED si monthsRemaining llega a 0
 * - Registra hitos en progressLog
 *
 * Devuelve:
 * - updatedDecisions: lista actualizada de LRD
 * - totalCost: costo total descontado este mes
 * - completed: LRD que se completaron este mes
 * - cancelled: LRD canceladas este mes
 */
export function advanceDecisions(
  state: GameState,
  input: TurnInput
): {
  updatedDecisions: LongRunningDecisionState[];
  totalCost: number;
  completed: LongRunningDecisionState[];
  cancelled: LongRunningDecisionState[];
} {
  const updated: LongRunningDecisionState[] = [];
  let totalCost = 0;
  const completed: LongRunningDecisionState[] = [];
  const cancelled: LongRunningDecisionState[] = [];

  const cancelSet = new Set(input.cancelDecisionIds ?? []);

  for (const lrd of (state.longRunningDecisions ?? [])) {
    // Saltar decisiones ya terminadas o canceladas
    if (lrd.status !== "IN_PROGRESS") {
      updated.push({ ...lrd });
      continue;
    }

    const updatedLrd = { ...lrd };

    // Cancelacion por orden del jugador
    if (cancelSet.has(lrd.id)) {
      updatedLrd.status = "CANCELLED";
      updatedLrd.cancelledAt = new Date().toISOString();
      updatedLrd.progressLog = [
        ...(lrd.progressLog ?? []),
        `Mes ${state.currentYear}/${state.currentMonth}: Cancelada por el jugador. Se pierde lo invertido.`,
      ];
      cancelled.push(updatedLrd);
    }
    // Avanzar un mes
    else {
      updatedLrd.monthsRemaining = Math.max(0, lrd.monthsRemaining - 1);
      totalCost += lrd.monthlyCost;

      if (updatedLrd.monthsRemaining <= 0) {
        updatedLrd.status = "COMPLETED";
        updatedLrd.completedAt = new Date().toISOString();
        updatedLrd.progressLog = [
          ...(lrd.progressLog ?? []),
          `Mes ${state.currentYear}/${state.currentMonth}: Completada exitosamente.`,
        ];
        completed.push(updatedLrd);
      }
    }

    updated.push(updatedLrd);
  }

  return { updatedDecisions: updated, totalCost, completed, cancelled };
}

/**
 * Crea nuevas LRD a partir del input del jugador.
 * Genera IDs unicos usando year/month/index.
 */
export function createNewDecisions(
  state: GameState,
  input: TurnInput
): LongRunningDecisionState[] {
  const newDecisions: LongRunningDecisionState[] = [];
  if (!input.newLongRunningDecisions) return newDecisions;

  let idx = 0;
  for (const config of input.newLongRunningDecisions) {
    const lrd: LongRunningDecisionState = {
      id: `lrd-${state.currentYear}-${state.currentMonth}-${idx}`,
      type: config.type,
      name: config.name,
      monthsRemaining: config.totalMonths,
      totalMonths: config.totalMonths,
      monthlyCost: config.monthlyCost,
      parameters: (config.parameters ?? {}) as Record<string, unknown>,
      status: "IN_PROGRESS",
      startedAt: new Date().toISOString(),
      completedAt: null,
      cancelledAt: null,
      progressLog: [
        `Mes ${state.currentYear}/${state.currentMonth}: Iniciada. Duracion prevista: ${config.totalMonths} meses.`,
      ],
      effectOnCompletion: (config.effectOnCompletion ?? {}) as Record<string, unknown>,
    };
    newDecisions.push(lrd);
    idx++;
  }

  return newDecisions;
}

/**
 * Aplica los efectos de LRD que se completaron este mes.
 * Por ahora OBRA_DE_PRUEBA no tiene efecto (no-op).
 * En el futuro cada type tendra su propio handler.
 */
export function applyDecisionEffects(
  completed: LongRunningDecisionState[],
  state: GameState
): void {
  for (const lrd of completed) {
    // TODO Salud-3, Defensa-3, etc.: handler por type
    // Por ahora todos los tipos son no-op.
    // Cuando se implementen tipos reales, agregar switch aquí.
    if (lrd.type === "OBRA_DE_PRUEBA") {
      // No-op: solo verifica el flujo completo
      continue;
    }
  }
}
