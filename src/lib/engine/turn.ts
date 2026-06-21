// ─── Orquestador principal del motor de turno ────────────────────────────────
// Ejecuta los 14 pasos del ciclo mensual en orden, usando funciones puras.
// Recibe GameState + TurnInput + rng, devuelve TurnOutput con el nuevo estado,
// snapshot, notificaciones, eventos y coberturas mediáticas.

import type {
  GameState,
  TurnInput,
  TurnOutput,
  MinistryState,
  OfficialState,
  OrganismState,
  JudicialCaseState,
  TurnNotification,
  EventState,
  MediaCoverageData,
} from "./types";
import { BALANCE } from "../balance";
// ── Funciones del motor (económicas, ministeriales, corrupción, indicadores)
import { calculateIncome } from "./economy";
import { calculateExpenses } from "./economy";
import { calculateTreasury } from "./economy";
import { calculateMinistryEfficiency } from "./ministries";
import { updateOfficialCorruption } from "./corruption";
import { calculateGlobalCorruption } from "./corruption";
import {
  calculatePoverty,
  calculateUnemployment,
  calculateHealth,
  calculateFoodSecurity,
  calculateCrime,
  calculateEducation,
  calculateGini,
  calculateInflationSimple,
  calculateSocialMobility,
} from "./indicators";
// ── Funciones escritas en este módulo ────────────────────────────────────
import { calculateApprovalByClass, calculateGeneralApproval, calculateClassDemands } from "./approval";
import { advanceJudicialCases, openAutoCases } from "./justice";
import { evaluateMotions } from "./congress";
import {
  calculateRegimeMetrics,
  classifyRegime,
  regenerateRegimeMetrics,
} from "./regime";
import { triggerRandomEvents } from "./events";
import { generateMediaCoverage } from "./media";
import { createMonthSnapshot } from "./snapshot";

/**
 * Clona profundamente el estado del juego para mutarlo de forma segura.
 */
function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

/**
 * Genera un ID único basado en año, mes y un contador.
 */
function generateId(
  prefix: string,
  year: number,
  month: number,
  index: number
): string {
  return `${prefix}-${year}-${month}-${index}`;
}

/**
 * Procesa un turno completo (un mes) de la simulación.
 *
 * Ejecuta los 14 pasos en orden:
 *  1. Aplicar decisiones del jugador
 *  2. Calcular income
 *  3. Calcular expenses
 *  4. Actualizar tesoro
 *  5. Calcular eficiencia ministerial
 *  6. Actualizar corrupción individual
 *  7. Calcular corrupción global
 *  8. Recalcular indicadores sociales
 *  9. Recalcular aprobación por clase
 * 10. Avanzar casos judiciales + abrir casos automáticos
 * 11. Recalcular métricas de régimen
 * 12. Disparar eventos aleatorios
 * 13. Generar coberturas mediáticas
 * 14. Crear snapshot mensual
 *
 * @param state - Estado actual del juego
 * @param input - Decisiones del jugador para este turno
 * @param rng - Función generadora de números aleatorios (determinista)
 * @returns Resultado completo del turno
 */
export function processTurn(
  state: GameState,
  input: TurnInput,
  rng: () => number
): TurnOutput {
  // Clonar estado para trabajar sobre copia mutable
  const newState = cloneState(state);
  const allNotifications: TurnNotification[] = [];
  let allNewEvents: EventState[] = [];
  let allMediaCoverages: MediaCoverageData[] = [];

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 1: Aplicar decisiones del jugador
  // ═══════════════════════════════════════════════════════════════════════

  // 1a. Ajustes de presupuesto por ministerio
  if (input.budgetAdjustments) {
    for (const [ministryKey, newPercent] of Object.entries(
      input.budgetAdjustments
    )) {
      const clamped = Math.max(
        BALANCE.MIN_BUDGET_PERCENT,
        Math.min(BALANCE.MAX_BUDGET_PERCENT, newPercent)
      );
      const ministry = newState.ministries.find(
        (m) => m.key === ministryKey
      );
      if (ministry) {
        ministry.budgetPercent = clamped;
      }
    }
  }

  // 1b. Cambios de sub-decisiones por ministerio
  if (input.subDecisionChanges) {
    for (const [ministryKey, changes] of Object.entries(
      input.subDecisionChanges
    )) {
      const ministry = newState.ministries.find(
        (m) => m.key === ministryKey
      );
      if (ministry) {
        for (const [subKey, value] of Object.entries(changes)) {
          ministry.subDecisions[subKey] = value;
        }
      }
    }
  }

  // 1c. Nombramientos: asignar funcionarios a roles
  if (input.appointments) {
    for (const [role, officialId] of Object.entries(input.appointments)) {
      const official = newState.officials.find(
        (o) => o.id === officialId
      );
      if (official) {
        official.role = role;
        // Buscar ministerio correspondiente al rol y asignarlo
        const matchingMinistry = newState.ministries.find(
          (m) =>
            m.key.toUpperCase() === role.toUpperCase() ||
            m.ministerOfficialId === null
        );
        if (matchingMinistry && !matchingMinistry.ministerOfficialId) {
          matchingMinistry.ministerOfficialId = official.id;
          official.ministryId = matchingMinistry.id;
        }
      }
    }
  }

  // 1d. Crear nuevos organismos
  if (input.newOrganisms) {
    let orgIndex = 0;
    for (const [type, config] of Object.entries(input.newOrganisms)) {
      const organism: OrganismState = {
        id: generateId("org", newState.currentYear, newState.currentMonth, orgIndex),
        type,
        name: config.name,
        monthlyBudget: config.monthlyBudget,
        staff: 10,
        effectiveness: 50,
        autonomyLevel: 50,
        headOfficialId: config.headOfficialId ?? null,
      };
      newState.organisms.push(organism);
      orgIndex++;

      if (config.headOfficialId) {
        const head = newState.officials.find(
          (o) => o.id === config.headOfficialId
        );
        if (head) {
          // Asignar rol válido según tipo de organismo
          const organismRoleMap: Record<string, string> = {
            COMPTROLLER: "COMPTROLLER",
            ANTICORRUPTION_PROSECUTION: "PROSECUTOR",
            INTELLIGENCE: "CHIEF_OF_INTELLIGENCE",
            OMBUDSMAN: "OMBUDSMAN",
            CONSTITUTIONAL_COURT: "JUDGE",
            CENTRAL_BANK: "CENTRAL_BANK_PRESIDENT",
          };
          head.role = organismRoleMap[type] ?? head.role;
          allNotifications.push({
            type: "info",
            title: "Nuevo organismo creado",
            description: `Se ha creado el organismo ${config.name} (${type}) con ${head.name} como director.`,
          });
        }
      }
    }
  }

  // 1e. Acciones sobre medios
  if (input.mediaActions) {
    for (const [mediaId, action] of Object.entries(input.mediaActions)) {
      const medium = newState.media.find((m) => m.id === mediaId);
      if (!medium) continue;

      switch (action) {
        case "censor":
          medium.status = "CENSORED";
          medium.credibility = Math.max(10, medium.credibility - 20);
          allNotifications.push({
            type: "warning",
            title: "Medio censurado",
            description: `El medio ${medium.name} ha sido censurado por el gobierno.`,
          });
          break;
        case "close":
          medium.status = "CLOSED";
          allNotifications.push({
            type: "warning",
            title: "Medio clausurado",
            description: `El medio ${medium.name} ha sido clausurado.`,
          });
          break;
        case "boost":
          medium.reach = Math.min(100, medium.reach + 10);
          medium.credibility = Math.min(100, medium.credibility + 5);
          allNotifications.push({
            type: "info",
            title: "Medio impulsado",
            description: `El gobierno ha impulsado al medio ${medium.name}.`,
          });
          break;
        case "none":
        default:
          break;
      }
    }
  }

  // 1f. Investigaciones: abrir casos judiciales contra funcionarios
  if (input.investigations && input.investigations.length > 0) {
    let caseIdx = 0;
    const prosecutors = newState.officials.filter(
      (o) => o.role === "PROSECUTOR" && o.status === "ACTIVE"
    );
    const judges = newState.officials.filter(
      (o) => o.role === "JUDGE" && o.status === "ACTIVE"
    );

    for (const officialId of input.investigations) {
      const official = newState.officials.find(
        (o) => o.id === officialId
      );
      if (!official) continue;

      const prosecutor =
        prosecutors.length > 0
          ? prosecutors[caseIdx % prosecutors.length]
          : null;
      const judge =
        judges.length > 0 ? judges[caseIdx % judges.length] : null;

      const investigationCase: JudicialCaseState = {
        id: generateId(
          "invest",
          newState.currentYear,
          newState.currentMonth,
          caseIdx
        ),
        defendantOfficialId: official.id,
        caseType: "CORRUPTION",
        currentPhase: "INVESTIGATION",
        monthsInPhase: 0,
        evidenceStrength: 30 + Math.floor(rng() * 30), // 30-60 inicial
        prosecutorId: prosecutor?.id ?? null,
        judgeId: judge?.id ?? null,
        verdict: null,
        sentenceMonths: null,
      };

      newState.judicialCases.push(investigationCase);
      official.status = "INVESTIGATED";
      caseIdx++;

      allNotifications.push({
        type: "case",
        title: "Investigación abierta",
        description: `Se ha abierto una investigación contra ${official.name} por orden del ejecutivo.`,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 2: Calcular ingresos fiscales
  // ═══════════════════════════════════════════════════════════════════════
  const income = calculateIncome(newState);

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 3: Calcular gastos
  // ═══════════════════════════════════════════════════════════════════════
  const expenses = calculateExpenses(newState);

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 4: Actualizar tesoro
  // ═══════════════════════════════════════════════════════════════════════
  newState.treasury = calculateTreasury(newState.treasury, income, expenses);

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 5: Calcular eficiencia de cada ministerio
  // ═══════════════════════════════════════════════════════════════════════
  for (const ministry of newState.ministries) {
    const minister = ministry.ministerOfficialId
      ? newState.officials.find((o) => o.id === ministry.ministerOfficialId)
      : undefined;
    ministry.efficiency = calculateMinistryEfficiency(ministry, minister);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 6: Actualizar corrupción individual de cada funcionario
  // ═══════════════════════════════════════════════════════════════════════
  for (const official of newState.officials) {
    official.corruption = updateOfficialCorruption(official, newState);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 7: Calcular corrupción global
  // ═══════════════════════════════════════════════════════════════════════
  const globalCorruption = calculateGlobalCorruption(newState.officials);

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 8: Recalcular indicadores sociales
  // (poverty, unemployment, health, food, crime, education, gini, inflation)
  // Estos se recalculan implícitamente en los pasos siguientes y en el
  // snapshot. Las funciones de cálculo están en snapshot.ts y se invocan
  // en el paso 14.
  // ═══════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 9: Recalcular aprobación por clase social
  // ═══════════════════════════════════════════════════════════════════════
  const eventsThisMonth = newState.events.filter(
    (e) =>
      e.year === newState.currentYear &&
      e.month === newState.currentMonth
  );

  for (const sc of newState.socialClasses) {
    sc.approval = calculateApprovalByClass(sc, newState, eventsThisMonth);
    // Recalcular demandas dinámicas según el estado actual
    sc.demands = calculateClassDemands(sc, newState);
  }

  // Recalcular movilidad social y actualizar porcentajes poblacionales
  const newPopulationPercents = calculateSocialMobility(newState);
  for (const sc of newState.socialClasses) {
    if (newPopulationPercents[sc.key] !== undefined) {
      sc.populationPercent = newPopulationPercents[sc.key];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 10: Avanzar casos judiciales + abrir casos automáticos
  // ═══════════════════════════════════════════════════════════════════════
  const { updatedCases, updatedOfficials, notifications: caseNotifications, regimeImpacts } =
    advanceJudicialCases(newState.judicialCases, newState.officials);
  newState.judicialCases = updatedCases;
  for (const upd of updatedOfficials) {
    const off = newState.officials.find((o) => o.id === upd.id);
    if (off) {
      off.status = upd.status;
      if ((upd as { corruption?: number }).corruption !== undefined) {
        off.corruption = (upd as { corruption?: number }).corruption!;
      }
    }
  }
  allNotifications.push(...caseNotifications);

  const { newCases, notifications: autoCaseNotifications } = openAutoCases(
    newState,
    rng
  );
  newState.judicialCases.push(...newCases);
  allNotifications.push(...autoCaseNotifications);

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 10.5: Evaluar mociones del congreso (censura, juicio político)
  // ═══════════════════════════════════════════════════════════════════════
  const currentApproval = calculateGeneralApproval(newState, []);
  const motions = evaluateMotions(
    {
      officials: newState.officials.map((o) => ({
        id: o.id, name: o.name, role: o.role,
        corruption: o.corruption, status: o.status,
      })),
      senators: newState.senators,
      parties: newState.parties,
      generalApproval: currentApproval,
    },
    rng,
  );

  for (const motion of motions) {
    if (motion.type === "censure_ministro" && motion.targetOfficialId) {
      const target = newState.officials.find((o) => o.id === motion.targetOfficialId);
      if (target) {
        target.status = "DISMISSED";
        allNotifications.push({
          type: "crisis",
          title: "Censura del Congreso",
          description: `El Congreso ha censurado al ministro ${motion.targetName}. Ha sido destituido de su cargo.`,
        });
      }
    } else if (motion.type === "juicio_politico") {
      allNotifications.push({
        type: "crisis",
        title: "Juicio politico iniciado",
        description: "El Congreso ha iniciado un juicio politico contra el mandatario. La situacion es critica y podria terminar en la destitucion.",
        severity: 90,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 11: Recalcular métricas de régimen + clasificar
  // ═══════════════════════════════════════════════════════════════════════
  // Detectar acciones del jugador que afectan el régimen
  const regimeActions = {
    censorMedia: Object.values(input.mediaActions ?? {}).some(
      (a) => a === "censor"
    ),
    nombrarJuecesAfines: Object.keys(input.appointments ?? {}).some(
      (r) => r === "JUDGE"
    ),
    // Disolver congreso: detectado si el jugador removió senadores sin reemplazo
    disolverCongreso: input.mediaActions
      ? Object.values(input.mediaActions).some((a) => a === "dissolve_congress")
      : false,
    // Estado de emergencia: detectado si la ley "estado-emergencia" está activa
    estadoEmergencia: newState.activeLaws.some(
      (l) => l.lawKey === "estado-emergencia"
    ),
    // Compra de votos: detectada si hay partyIds con beneficios
    comprarVotos:
      input.voteBuyingPartyIds !== undefined &&
      input.voteBuyingPartyIds.length > 0,
  };

  // Guardar métricas antes de aplicar modificadores (para regeneración)
  const metricsBefore = { ...newState.regimeMetrics };

  // Aplicar modificadores de acciones + leyes + organismos + veredictos
  newState.regimeMetrics = calculateRegimeMetrics(
    newState.regimeMetrics,
    regimeActions,
    newState.activeLaws,
    newState.organisms,
    regimeImpacts
  );

  // Regeneración gradual hacia el baseline (solo métricas no modificadas)
  newState.regimeMetrics = regenerateRegimeMetrics(
    newState.regimeMetrics,
    metricsBefore
  );

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 12: Disparar eventos aleatorios
  // ═══════════════════════════════════════════════════════════════════════
  const { newEvents, notifications: eventNotifications } =
    triggerRandomEvents(newState, rng);

  newState.events.push(...newEvents);
  allNewEvents = newEvents;
  allNotifications.push(...eventNotifications);

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 13: Generar coberturas mediáticas
  // ═══════════════════════════════════════════════════════════════════════
  const allEventsThisMonth = [
    ...eventsThisMonth,
    ...newEvents,
  ];

  allMediaCoverages = generateMediaCoverage(
    newState,
    allEventsThisMonth,
    rng
  );

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 14: Crear MonthSnapshot
  // ═══════════════════════════════════════════════════════════════════════
  const monthSnapshot = createMonthSnapshot(
    newState,
    newState.currentYear,
    newState.currentMonth
  );

  // ── Construir y devolver resultado ─────────────────────────────────────
  return {
    newState,
    monthSnapshot,
    notifications: allNotifications,
    newEvents: allNewEvents,
    mediaCoverages: allMediaCoverages,
  };
}
