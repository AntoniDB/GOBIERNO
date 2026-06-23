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
 * Genera un veredicto para un caso al entrar a la fase de sentencia.
 * La probabilidad de culpabilidad depende de la fuerza de evidencia,
 * modulada por la corrupción del juez asignado (SPEC §4.3).
 */
function generateVerdict(
  evidenceStrength: number,
  judgeCorruption: number,
  rng: () => number
): { verdict: "GUILTY" | "NOT_GUILTY"; sentenceMonths: number | null } {
  // Corrupción del juez: reduce la probabilidad de culpabilidad
  // Un juez corrupto (corruption=100) reduce guiltyChance en 30 puntos porcentuales
  const corruptionPenalty = (judgeCorruption / 100) * 30;
  const guiltyChance = Math.max(0, evidenceStrength / 100 - corruptionPenalty / 100);
  const guilty = rng() < guiltyChance;

  if (guilty) {
    // Sentencia: 6 a 120 meses según evidencia
    const base = Math.floor((evidenceStrength / 100) * 60);
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
 * @returns Casos actualizados, notificaciones generadas e impactos en régimen
 */
export function advanceJudicialCases(
  cases: JudicialCaseState[],
  officials: OfficialState[]
): {
  updatedCases: JudicialCaseState[];
  updatedOfficials: { id: string; status: string; corruption?: number }[];
  notifications: TurnNotification[];
  regimeImpacts: { type: string; value: number }[];
} {
  const updatedOfficials = new Map<string, OfficialState>();
  for (const o of officials) {
    updatedOfficials.set(o.id, { ...o });
  }

  const notifications: TurnNotification[] = [];
  const updatedCases: JudicialCaseState[] = [];
  const regimeImpacts: { type: string; value: number }[] = [];

  for (const c of cases) {
    if (c.currentPhase === "CLOSED") {
      updatedCases.push({ ...c });
      continue;
    }

    const updated = { ...c, monthsInPhase: c.monthsInPhase + 1 };
    const threshold = getPhaseThreshold(c.id, c.currentPhase);

    if (updated.monthsInPhase >= threshold) {
      const caseRng = createRNG(c.id + "-verdict-" + c.monthsInPhase);

      // Generar veredicto al SALIR de TRIAL (entrar a SENTENCING)
      // SPEC §4.3: el veredicto se emite al finalizar el juicio
      if (c.currentPhase === "TRIAL") {
        // Buscar corrupción del juez asignado para modular el veredicto
        const judge = c.judgeId
          ? updatedOfficials.get(c.judgeId)
          : null;
        const judgeCorruption = judge?.corruption ?? 10;

        const { verdict, sentenceMonths } = generateVerdict(
          c.evidenceStrength,
          judgeCorruption,
          caseRng
        );
        updated.verdict = verdict;
        updated.sentenceMonths = sentenceMonths;
      }

      const prevPhase = updated.currentPhase;
      updated.currentPhase = getNextPhase(c.currentPhase, caseRng);
      updated.monthsInPhase = 0;

      // Transiciones de status del oficial acusado
      if (updated.currentPhase === "TRIAL") {
        const defendant = updatedOfficials.get(c.defendantOfficialId);
        if (defendant) {
          defendant.status = "INDICTED";
          updatedOfficials.set(defendant.id, defendant);
        }
      }

      // Al cerrar el caso (SENTENCING → CLOSED o APPEAL → CLOSED), aplicar consecuencias
      if (updated.currentPhase === "CLOSED") {
        const official = updatedOfficials.get(c.defendantOfficialId);
        if (official) {
          if (updated.verdict === "GUILTY") {
            // Culpable: destitución o condena según el rol (SPEC §4.3)
            if (official.role === "MINISTER") {
              official.status = "DISMISSED";
              notifications.push({
                type: "case",
                title: "Ministro destituido",
                description: `${official.name} ha sido condenado y destituido de su cargo como ministro. Sentencia: ${updated.sentenceMonths} meses de prisión.`,
              });
            } else if (official.role === "GENERAL") {
              official.status = "CONVICTED";
              regimeImpacts.push({
                type: "militarySubordination",
                value: BALANCE.REGIME_SUBORDINAR_GENERALES.militarySubordination,
              });
              notifications.push({
                type: "case",
                title: "General condenado",
                description: `${official.name} (General) ha sido condenado. La subordinación militar al poder civil se fortalece. Sentencia: ${updated.sentenceMonths} meses de prisión.`,
              });
            } else {
              official.status = "CONVICTED";
            }

            if (c.caseType === "CORRUPTION") {
              official.corruption = Math.max(0, official.corruption - 20);
            }
          } else {
            // Inocente: restaurar estatus a ACTIVE para que pueda seguir en funciones
            // y estar disponible para futuras investigaciones si su corrupción lo amerita
            official.status = "ACTIVE";
            notifications.push({
              type: "case",
              title: "Funcionario absuelto",
              description: `${official.name} ha sido declarado inocente y retoma sus funciones.`,
            });
          }
          updatedOfficials.set(official.id, official);
        }
      }

      // Notificación de cambio de fase con detalle del veredicto si aplica
      const phaseNames: Record<string, string> = {
        INVESTIGATION: "Investigación",
        TRIAL: "Juicio",
        SENTENCING: "Sentencia",
        APPEAL: "Apelación",
        CLOSED: "Cerrado",
      };

      const verdictText = updated.verdict
        ? updated.verdict === "GUILTY"
          ? ` | Veredicto: Culpable (${updated.sentenceMonths} meses)`
          : " | Veredicto: Inocente"
        : "";

      notifications.push({
        type: "case",
        title: "Caso judicial: cambio de fase",
        description: `El caso de ${c.caseType.toLowerCase()} avanzó de ${phaseNames[prevPhase] ?? prevPhase} a ${phaseNames[updated.currentPhase] ?? updated.currentPhase}.${verdictText}`,
      });
    }

    updatedCases.push(updated);
  }

  // Devolver officials actualizados con cambios de status y corrupción
  const updatedOfficialsList: { id: string; status: string; corruption?: number }[] = [];
  for (const [id, o] of updatedOfficials) {
    updatedOfficialsList.push({ id, status: o.status, corruption: o.corruption });
  }
  return { updatedCases, updatedOfficials: updatedOfficialsList, notifications, regimeImpacts };
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
    (o) => o.type === "ANTICORRUPTION_PROSECUTION"
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
    if (official.status === "CONVICTED" || official.status === "DISMISSED") continue;

    // Verificar si ya existe un caso activo del mismo tipo para este funcionario
    // Evita duplicados: un funcionario no puede tener dos casos CORRUPTION abiertos
    // simultaneamente. Si permite caseTypes distintos (CORRUPTION + CRIMINAL).
    const existingActiveCase = state.judicialCases.find(
      (jc) =>
        jc.defendantOfficialId === official.id &&
        jc.caseType === "CORRUPTION" &&
        jc.currentPhase !== "CLOSED"
    );
    if (existingActiveCase) continue;

    // Probabilidad mensual de apertura de caso
    let monthlyProb =
      BALANCE.JUSTICE_AUTO_CASE_MONTHLY_PROB * (fiscaliaEff / 100);

    // Bonus por alta autonomía de la Fiscalía
    if (fiscalia && fiscalia.autonomyLevel > 70) {
      monthlyProb *= 1.5;
    }

    if (rng() < monthlyProb) {
      // Excluir al acusado de la lista de fiscales y jueces
      const eligibleProsecutors = prosecutors.filter(
        (o) => o.id !== official.id
      );
      const eligibleJudges = judges.filter(
        (o) => o.id !== official.id
      );

      if (eligibleProsecutors.length === 0 || eligibleJudges.length === 0) continue;

      const prosecutor = randomPick(eligibleProsecutors, rng);
      const judge = randomPick(eligibleJudges, rng);

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
      // Marcar al oficial como INVESTIGATED
      official.status = "INVESTIGATED";

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
