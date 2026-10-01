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
import { scaleCost } from "./cost-scale";

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

const HOSPITAL_LEVELS = ["primary", "secondary", "tertiary"] as const;

/** Máximo de enfermedades por investigación médica. */
const MAX_RESEARCH_DISEASES = 2;

type DecisionRequest = NonNullable<TurnInput["newLongRunningDecisions"]>[number];

type DecisionBuild =
  | { ok: true; decision: Pick<LongRunningDecisionState, "type" | "name" | "totalMonths" | "monthlyCost" | "parameters"> }
  | { ok: false; reason: string };

/**
 * Construye una LRD a partir de lo único que el cliente decide (tipo y parámetros).
 * Nombre, duración y costo salen de BALANCE y del estado: un cliente manipulado no
 * puede abaratar ni acortar una obra. Devuelve el motivo si la solicitud es inválida.
 */
export function buildDecision(state: GameState, request: DecisionRequest): DecisionBuild {
  const params = (request?.parameters ?? {}) as Record<string, unknown>;

  switch (request?.type) {
    case "HOSPITAL_CONSTRUCTION": {
      const level = HOSPITAL_LEVELS.find((l) => l === params.level);
      if (!level) return { ok: false, reason: "nivel de hospital inválido" };
      const region = state.regions.find((r) => r.id === params.regionId);
      if (!region) return { ok: false, reason: "región inexistente" };
      return {
        ok: true,
        decision: {
          type: "HOSPITAL_CONSTRUCTION",
          name: `Construcción hospital ${level} — ${region.name}`,
          totalMonths: BALANCE.HOSPITAL_DURATIONS[level],
          monthlyCost: scaleCost(BALANCE.HOSPITAL_COSTS[level], state.population),
          parameters: { regionId: region.id, level },
        },
      };
    }
    case "MEDICAL_RESEARCH": {
      const requested = Array.isArray(params.diseaseIds) ? params.diseaseIds : [];
      const diseases = [...new Set(requested)]
        .map((id) => state.diseases.find((d) => d.id === id))
        .filter((d): d is NonNullable<typeof d> => d !== undefined);
      if (diseases.length === 0) return { ok: false, reason: "enfermedad inexistente" };
      if (diseases.length > MAX_RESEARCH_DISEASES) {
        return { ok: false, reason: `máximo ${MAX_RESEARCH_DISEASES} enfermedades por investigación` };
      }
      return {
        ok: true,
        decision: {
          type: "MEDICAL_RESEARCH",
          name: `Investigación médica — ${diseases.map((d) => d.name).join(", ")}`,
          totalMonths: BALANCE.MEDICAL_RESEARCH_DURATION,
          monthlyCost: scaleCost(BALANCE.MEDICAL_RESEARCH_COST, state.population),
          parameters: { diseaseIds: diseases.map((d) => d.id) },
        },
      };
    }
    default:
      return { ok: false, reason: "tipo de decisión no reconocido" };
  }
}

/**
 * Crea las nuevas LRD del input del jugador (validadas con buildDecision).
 * Las solicitudes inválidas se descartan y se devuelven como `rejections`.
 * Genera IDs unicos usando year/month/index.
 */
export function createNewDecisions(
  state: GameState,
  input: TurnInput
): { decisions: LongRunningDecisionState[]; rejections: string[] } {
  const decisions: LongRunningDecisionState[] = [];
  const rejections: string[] = [];

  for (const request of input.newLongRunningDecisions ?? []) {
    const built = buildDecision(state, request);
    if (!built.ok) {
      rejections.push(`Decisión rechazada: ${built.reason}.`);
      continue;
    }
    const { decision } = built;
    decisions.push({
      id: `lrd-${state.currentYear}-${state.currentMonth}-${decisions.length}`,
      ...decision,
      monthsRemaining: decision.totalMonths,
      status: "IN_PROGRESS",
      startedAt: new Date().toISOString(),
      completedAt: null,
      cancelledAt: null,
      progressLog: [
        `Mes ${state.currentYear}/${state.currentMonth}: Iniciada. Duracion prevista: ${decision.totalMonths} meses.`,
      ],
      effectOnCompletion: {},
    });
  }

  return { decisions, rejections };
}

/**
 * Aplica los efectos de LRD que se completaron este mes.
 * Cada tipo de decision tiene su propio handler.
 */
export function applyDecisionEffects(
  completed: LongRunningDecisionState[],
  state: GameState
): void {
  for (const lrd of completed) {
    switch (lrd.type) {
      case "OBRA_DE_PRUEBA":
        // No-op: solo verifica el flujo completo
        continue;
      case "HOSPITAL_CONSTRUCTION": {
        // Suma beds + facilities a la region elegida en parameters
        const regionId = lrd.parameters.regionId as string;
        const level = lrd.parameters.level as "primary" | "secondary" | "tertiary";
        if (!regionId || !level) continue;
        const region = state.regions.find((r) => r.id === regionId);
        if (!region) continue;
        const hc = region.healthCoverage?.[level] ?? { facilities: 0, beds: 0, operationalCost: 0 };
        hc.beds = (hc.beds ?? 0) + (BALANCE.HOSPITAL_BEDS_ADDED[level] ?? 0);
        hc.facilities = (hc.facilities ?? 0) + (BALANCE.HOSPITAL_FACILITIES_ADDED[level] ?? 0);
        // operationalCost se mantiene (el LRD ya pago la construccion)
        if (!region.healthCoverage) region.healthCoverage = {} as GameState["regions"][0]["healthCoverage"];
        region.healthCoverage[level] = hc;
        break;
      }
      case "MEDICAL_RESEARCH": {
        // 1-2 enfermedades elegidas en parameters.diseaseIds
        const diseaseIds = (lrd.parameters.diseaseIds as string[] | undefined) ?? [];
        if (diseaseIds.length === 0) continue;
        for (const diseaseId of diseaseIds) {
          const disease = state.diseases.find((d) => d.id === diseaseId);
          if (!disease) continue;
          if (disease.hasVaccine) {
            // Ya tenia vacuna: reducir mortalityRate permanentemente a la mitad
            disease.mortalityRate = disease.mortalityRate * BALANCE.MEDICAL_RESEARCH_MORTALITY_REDUCTION;
          } else {
            // No tenia vacuna: desbloquear vacuna (habilita campañas)
            disease.hasVaccine = true;
          }
        }
        break;
      }
    }
  }
}
