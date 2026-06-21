// ─── Sistema judicial ────────────────────────────────────────────────────────
// Avance de casos judiciales y apertura automática de casos por corrupción.
// Funciones puras y deterministas.

import type {
  GameState,
  JudicialCaseState,
  OfficialState,
  TurnNotification,
} from "./types";
import { BALANCE } from "../balance";
import { createRNG, randomPick } from "../rng";

/**
 * Calcula el umbral de meses para una fase judicial usando un hash
 * determinista del ID del caso + fase actual.
 * Usa BALANCE.JUSTICE_*_MIN_MONTHS como mínimo más una variación.
 */
function getPhaseThreshold(
  caseId: string,
  phase: string
): number {
  const caseRng = createRNG(caseId + "-" + phase);
  switch (phase) {
    case "INVESTIGATION": {
      const variation = Math.floor(
        caseRng() *
          (BALANCE.JUSTICE_INVESTIGATION_MAX_MONTHS -
            BALANCE.JUSTICE_INVESTIGATION_MIN_MONTHS +
            1)
      );
      return BALANCE.JUSTICE_INVESTIGATION_MIN_MONTHS + variation;
    }
    case "TRIAL": {
      const variation = Math.floor(
        caseRng() *
          (BALANCE.JUSTICE_TRIAL_MAX_MONTHS -
            BALANCE.JUSTICE_TRIAL_MIN_MONTHS +
            1)
      );
      return BALANCE.JUSTICE_TRIAL_MIN_MONTHS + variation;
    }
    case "SENTENCING":
      // Fase de sentencia: 1 a 3 meses
      return 1 + Math.floor(caseRng() * 3);
    case "APPEAL":
      // Fase de apelación: 2 a 4 meses
      return 2 + Math.floor(caseRng() * 3);
    default:
      return 1;
  }
}

/**
 * Determina la siguiente fase en el flujo judicial.
 * INVESTIGATION → TRIAL → SENTENCING → APPEAL (50%) → CLOSED
 */
function getNextPhase(
  currentPhase: string,
  rng: () => number
): string {
  switch (currentPhase) {
    case "INVESTIGATION":
      return "TRIAL";
    case "TRIAL":
      return "SENTENCING";
    case "SENTENCING":
      // 50% de probabilidad de apelación
      return rng() < 0.5 ? "APPEAL" : "CLOSED";
    case "APPEAL":
      return "CLOSED";
    default:
      return "CLOSED";
  }
}

/**
 * Genera un veredicto para un caso que llega a CLOSED.
 * La probabilidad de culpabilidad depende de la fuerza de evidencia.
 */
function generateVerdict(
  evidenceStrength: number,
  rng: () => number
): { verdict: string; sentenceMonths: number | null } {
  // evidenceStrength 0-100; a mayor evidencia, más probable culpable
  const guiltyChance = evidenceStrength / 100;
  const guilty = rng() < guiltyChance;

  if (guilty) {
    // Sentencia: 6 a 120 meses según evidencia
    const base = Math.floor(evidenceStrength / 100 * 60);
    const variation = Math.floor(rng() * 60);
    return {
      verdict: "GUILTY",
      sentenceMonths: Math.max(6, base + variation),
    };
  }
  return {
    verdict: "NOT_GUILTY",
    sentenceMonths: null,
  };
}

/**
 * Avanza todos los casos judiciales un mes.
 * Cada caso incrementa monthsInPhase; si supera el umbral de su fase,
 * transiciona a la siguiente fase del flujo judicial.
 *
 * @param cases - Lista de casos judiciales activos
 * @param officials - Lista de funcionarios (para marcar CONVICTED)
 * @returns Casos actualizados y notificaciones generadas
 */
export function advanceJudicialCases(
  cases: JudicialCaseState[],
  officials: OfficialState[]
): {
  updatedCases: JudicialCaseState[];
  notifications: TurnNotification[];
} {
  const updatedOfficials = new Map<string, OfficialState>();
  for (const o of officials) {
    updatedOfficials.set(o.id, { ...o });
  }

  const notifications: TurnNotification[] = [];
  const updatedCases: JudicialCaseState[] = [];

  for (const c of cases) {
    if (c.currentPhase === "CLOSED") {
      // Caso cerrado: no avanza
      updatedCases.push({ ...c });
      continue;
    }

    const updated = { ...c, monthsInPhase: c.monthsInPhase + 1 };
    const threshold = getPhaseThreshold(c.id, c.currentPhase);

    if (updated.monthsInPhase >= threshold) {
      // Determinar si hay veredicto en fase SENTENCING → CLOSED
      const caseRng = createRNG(c.id + "-verdict-" + updated.monthsInPhase);

      if (c.currentPhase === "SENTENCING" || c.currentPhase === "APPEAL") {
        const { verdict, sentenceMonths } = generateVerdict(
          c.evidenceStrength,
          caseRng
        );
        updated.verdict = verdict;
        updated.sentenceMonths = sentenceMonths;

        if (verdict === "GUILTY" && updated.currentPhase !== "APPEAL") {
          // Solo se marca convicto si no hay apelación pendiente
        }
      }

      const prevPhase = updated.currentPhase;
      updated.currentPhase = getNextPhase(c.currentPhase, caseRng);
      updated.monthsInPhase = 0;

      // Si llega a CLOSED con veredicto culpable, marcar funcionario como CONVICTED
      if (
        updated.currentPhase === "CLOSED" &&
        updated.verdict === "GUILTY"
      ) {
        const official = updatedOfficials.get(c.defendantOfficialId);
        if (official) {
          official.status = "CONVICTED";
          updatedOfficials.set(official.id, official);
        }
      }

      // Generar notificación por cambio de fase
      const phaseNames: Record<string, string> = {
        INVESTIGATION: "Investigación",
        TRIAL: "Juicio",
        SENTENCING: "Sentencia",
        APPEAL: "Apelación",
        CLOSED: "Cerrado",
      };

      notifications.push({
        type: "case",
        title: `Caso judicial: cambio de fase`,
        description: `El caso ${c.id} avanzó de ${phaseNames[prevPhase] ?? prevPhase} a ${phaseNames[updated.currentPhase] ?? updated.currentPhase}.${updated.verdict ? " Veredicto: " + (updated.verdict === "GUILTY" ? "Culpable" : "Inocente") : ""}`,
      });
    }

    updatedCases.push(updated);
  }

  // Reconstruir lista de officials con los cambios
  // (no modificamos el array original, solo devolvemos casos)
  return { updatedCases, notifications };
}

/**
 * Abre casos automáticos contra funcionarios con corrupción elevada.
 *
 * @param state - Estado completo del juego
 * @param rng - Función generadora de números aleatorios
 * @returns Nuevos casos creados y notificaciones
 */
export function openAutoCases(
  state: GameState,
  rng: () => number
): {
  newCases: JudicialCaseState[];
  notifications: TurnNotification[];
} {
  const newCases: JudicialCaseState[] = [];
  const notifications: TurnNotification[] = [];

  // Encontrar la Fiscalía (organismo tipo FISCALIA o ANTICORRUPCION)
  const fiscalia = state.organisms.find(
    (o) =>
      o.type === "FISCALIA" ||
      o.type === "ANTICORRUPCION" ||
      o.type === "PROSECUTOR_OFFICE"
  );
  const fiscaliaEff = fiscalia?.effectiveness ?? 50;

  // Funcionarios disponibles como fiscales y jueces
  const prosecutors = state.officials.filter(
    (o) => o.role === "PROSECUTOR" && o.status === "ACTIVE"
  );
  const judges = state.officials.filter(
    (o) => o.role === "JUDGE" && o.status === "ACTIVE"
  );

  if (prosecutors.length === 0 || judges.length === 0) {
    // Sin fiscales o jueces disponibles no se pueden abrir casos
    return { newCases, notifications };
  }

  // Revisar cada funcionario con corrupción por encima del umbral
  for (const official of state.officials) {
    if (official.corruption < BALANCE.CORRUPTION_AUTO_CASE_THRESHOLD) continue;
    if (official.status === "CONVICTED" || official.status === "IMPRISONED") continue;

    // Probabilidad mensual de apertura de caso
    const monthlyProb =
      BALANCE.JUSTICE_AUTO_CASE_MONTHLY_PROB * (fiscaliaEff / 100);

    if (rng() < monthlyProb) {
      const prosecutor = randomPick(prosecutors, rng);
      const judge = randomPick(judges, rng);

      // Evidencia inicial: depende de la corrupción del funcionario
      const evidenceStrength = Math.min(
        90,
        Math.max(10, official.corruption * 0.8 + rng() * 20 - 10)
      );

      const newCase: JudicialCaseState = {
        id: `auto-${state.currentYear}-${state.currentMonth}-${official.id}`,
        defendantOfficialId: official.id,
        caseType: "CORRUPTION",
        currentPhase: "INVESTIGATION",
        monthsInPhase: 0,
        evidenceStrength: Math.round(evidenceStrength),
        prosecutorId: prosecutor.id,
        judgeId: judge.id,
        verdict: null,
        sentenceMonths: null,
      };

      newCases.push(newCase);

      notifications.push({
        type: "case",
        title: "Nuevo caso judicial por corrupción",
        description: `Se ha abierto una investigación contra ${official.name} por corrupción (nivel: ${Math.round(official.corruption)}%). Fiscal asignado: ${prosecutor.name}.`,
        severity: official.corruption / 100,
      });
    }
  }

  return { newCases, notifications };
}
