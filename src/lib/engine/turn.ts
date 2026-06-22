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
  MediaPollData,
} from "./types";
import { BALANCE } from "../balance";
// ── Funciones del motor (económicas, ministeriales, corrupción, indicadores)
import { calculateIncome } from "./economy";
import { calculateExpenses } from "./economy";
import { calculateTreasury } from "./economy";
import { calculateGDP } from "./economy";
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
import { triggerRandomEvents, applyEventEffects } from "./events";
import { generateMediaCoverage, generateDecisionCoverage, generateEditorialCoverage, generateMediaPolls, generateInvestigativeReports } from "./media";
import { createMonthSnapshot } from "./snapshot";
import { checkGameOverConditions, canBeAssassinated, electionResult } from "./game-over";
import { generateCandidates, removeExpiredCandidates } from "./candidates";

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
  let allMediaPolls: MediaPollData[] = [];

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

  // 1c. Nombramientos: asignar funcionarios a ministerios
  if (input.appointments) {
    for (const [ministryKey, officialId] of Object.entries(input.appointments)) {
      const official = newState.officials.find(
        (o) => o.id === officialId
      );
      if (!official) continue;

      const matchingMinistry = newState.ministries.find(
        (m) => m.key === ministryKey
      );
      if (!matchingMinistry) continue;

      // Si ya tenia un ministro, desasignarlo
      if (matchingMinistry.ministerOfficialId) {
        const oldMinister = newState.officials.find(
          (o) => o.id === matchingMinistry.ministerOfficialId
        );
        if (oldMinister) {
          oldMinister.ministryId = null;
        }
      }

      // Si el nuevo oficial ya estaba en otro ministerio, desasignarlo de alli
      if (official.ministryId) {
        const oldMinistry = newState.ministries.find(
          (m) => m.id === official.ministryId
        );
        if (oldMinistry) {
          oldMinistry.ministerOfficialId = null;
        }
      }

      matchingMinistry.ministerOfficialId = official.id;
      official.ministryId = matchingMinistry.id;
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
            TAX_AGENCY: "COMPTROLLER",
            ELECTORAL_COUNCIL: "JUDGE",
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

  // 1d. Cambiar titular de organismos existentes
  if (input.organismHeadChanges) {
    const organismRoleMap: Record<string, string> = {
      COMPTROLLER: "COMPTROLLER",
      ANTICORRUPTION_PROSECUTION: "PROSECUTOR",
      INTELLIGENCE: "CHIEF_OF_INTELLIGENCE",
      OMBUDSMAN: "OMBUDSMAN",
      CONSTITUTIONAL_COURT: "JUDGE",
      CENTRAL_BANK: "CENTRAL_BANK_PRESIDENT",
      TAX_AGENCY: "COMPTROLLER",
      ELECTORAL_COUNCIL: "JUDGE",
    };
    for (const [organismId, headOfficialId] of Object.entries(input.organismHeadChanges)) {
      const org = newState.organisms.find((o) => o.id === organismId);
      if (!org) continue;
      const head = newState.officials.find((o) => o.id === headOfficialId);
      if (!head) continue;

      // Si el oficial ya lideraba otro organismo, desasignarlo
      for (const other of newState.organisms) {
        if (other.id !== organismId && other.headOfficialId === headOfficialId) {
          other.headOfficialId = null;
        }
      }

      org.headOfficialId = headOfficialId;
      head.role = organismRoleMap[org.type] ?? head.role;

      allNotifications.push({
        type: "info",
        title: "Titular asignado",
        description: `${head.name} ha sido designado como nuevo titular del organismo ${org.name}.`,
      });
    }
  }

  // 1d-2. Disolver organismos
  if (input.dissolveOrganismIds && input.dissolveOrganismIds.length > 0) {
    // Mapa de impacto en métricas de régimen al disolver cada tipo
    const dissolveRegimeImpacts: Record<string, Record<string, number>> = {
      COMPTROLLER: { transparency: -10, powerConcentration: 3 },
      ANTICORRUPTION_PROSECUTION: { transparency: -8, judicialIndependence: -5, powerConcentration: 3 },
      INTELLIGENCE: { civilLiberties: -3, powerConcentration: -2 },
      OMBUDSMAN: { civilLiberties: -10, transparency: -5, powerConcentration: 5 },
      CONSTITUTIONAL_COURT: { judicialIndependence: -15, powerConcentration: 8 },
      CENTRAL_BANK: { powerConcentration: 3 },
      TAX_AGENCY: { transparency: -5, powerConcentration: 2 },
      ELECTORAL_COUNCIL: { politicalPluralism: -12, powerConcentration: 8 },
    };

    for (const organismId of input.dissolveOrganismIds) {
      const org = newState.organisms.find((o) => o.id === organismId);
      if (!org || org.effectiveness <= 0) continue;

      // Liberar al titular
      if (org.headOfficialId) {
        const head = newState.officials.find((o) => o.id === org.headOfficialId);
        if (head) {
          head.ministryId = null;
          head.status = "ACTIVE";
        }
        org.headOfficialId = null;
      }

      // Marcar como disuelto (efectividad a 0)
      org.effectiveness = 0;
      org.monthlyBudget = 0;
      org.staff = 0;
      // Reintegrar presupuesto al tesoro (una devolución simbólica)
      // El ajuste real se hace via el presupuesto mensual que ya no se gasta

      // Aplicar impactos en métricas de régimen
      const regimeMetricKeys: Record<string, keyof typeof newState.regimeMetrics> = {
        transparency: "transparency",
        judicialIndependence: "judicialIndependence",
        civilLiberties: "civilLiberties",
        powerConcentration: "powerConcentration",
        politicalPluralism: "politicalPluralism",
      };
      const impacts = dissolveRegimeImpacts[org.type] ?? {};
      for (const [key, value] of Object.entries(impacts)) {
        const metricKey = regimeMetricKeys[key];
        if (metricKey) {
          const current = newState.regimeMetrics[metricKey];
          newState.regimeMetrics[metricKey] = Math.max(0, Math.min(100, current + value));
        }
      }

      allNotifications.push({
        type: "info",
        title: "Organismo disuelto",
        description: `El organismo ${org.name} ha sido disuelto. Su titular y presupuesto han sido liberados.`,
      });
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
        case "restore":
          medium.status = "ACTIVE";
          allNotifications.push({
            type: "info",
            title: "Medio restaurado",
            description: `El medio ${medium.name} ha sido restaurado y vuelve a operar libremente.`,
          });
          break;
        case "buyAffinity":
          // Siempre se puede comprar afinidad, incluso si el medio esta CENSORED o CLOSED
          if (newState.treasury >= BALANCE.MEDIA_BUY_AFFINITY_COST) {
            newState.treasury -= BALANCE.MEDIA_BUY_AFFINITY_COST;
            medium.governmentAffinity = Math.min(
              100,
              medium.governmentAffinity + BALANCE.MEDIA_BUY_AFFINITY_AMOUNT
            );
            // La compra de afinidad implica acuerdos bajo mesa que reducen transparencia
            newState.regimeMetrics.transparency = Math.max(
              0,
              newState.regimeMetrics.transparency + BALANCE.MEDIA_BUY_AFFINITY_TRANSPARENCY_PENALTY
            );
            allNotifications.push({
              type: "info",
              title: "Afinidad mediatica comprada",
              description: `Se ha mejorado la afinidad de ${medium.name} mediante incentivos economicos. Costo: M$ ${(BALANCE.MEDIA_BUY_AFFINITY_COST / 1_000_000).toFixed(1)}.`,
            });
          }
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

    // Dedeuplicar: el mismo officialId solo se procesa una vez
    const seenIds = new Set<string>();

    for (const officialId of input.investigations) {
      if (seenIds.has(officialId)) continue;
      seenIds.add(officialId);

      const official = newState.officials.find(
        (o) => o.id === officialId
      );
      if (!official) continue;

      // Verificar si ya existe un caso activo del mismo tipo para este funcionario
      const existingActive = newState.judicialCases.find(
        (jc) =>
          jc.defendantOfficialId === official.id &&
          jc.caseType === "CORRUPTION" &&
          jc.currentPhase !== "CLOSED"
      );
      if (existingActive) continue;

      // Excluir al acusado de la lista de fiscales y jueces
      const eligibleProsecutors = prosecutors.filter(
        (o) => o.id !== official.id
      );
      const eligibleJudges = judges.filter(
        (o) => o.id !== official.id
      );
      if (eligibleProsecutors.length === 0 || eligibleJudges.length === 0) continue;

      const prosecutor =
        eligibleProsecutors.length > 0
          ? eligibleProsecutors[caseIdx % eligibleProsecutors.length]
          : null;
      const judge =
        eligibleJudges.length > 0 ? eligibleJudges[caseIdx % eligibleJudges.length] : null;

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
        evidenceStrength: 30 + Math.floor(rng() * 30),
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

  // 1g. Contratar candidatos: cambiar status de CANDIDATE a ACTIVE
  // y descontar el costo del tesoro
  if (input.hireCandidateIds && input.hireCandidateIds.length > 0) {
    for (const candidateId of input.hireCandidateIds) {
      const candidate = newState.officials.find(
        (o) => o.id === candidateId && o.status === "CANDIDATE"
      );
      if (!candidate) continue;

      const sameRoleCount = newState.officials.filter(
        (o) => o.role === candidate.role && o.status === "ACTIVE"
      ).length;
      const hireCost =
        BALANCE.CANDIDATE_HIRE_COST_BASE +
        sameRoleCount * BALANCE.CANDIDATE_HIRE_COST_PER_SAME_ROLE;

      if (newState.treasury >= hireCost) {
        newState.treasury -= hireCost;
        candidate.status = "ACTIVE";
        allNotifications.push({
          type: "info",
          title: "Candidato contratado",
          description: `${candidate.name} ha sido contratado como ${candidate.role}. Costo: M$ ${(hireCost / 1_000_000).toFixed(1)}.`,
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 1h: Pool de candidatos naturales
  // Cada 6 meses se generan nuevos funcionarios (candidatos) segun el
  // nivel educativo. Los candidatos expiran si no se contratan en 6 meses.
  // ═══════════════════════════════════════════════════════════════════════
  newState.officials = removeExpiredCandidates(
    newState.officials,
    newState.currentYear,
    newState.currentMonth
  );

  const newCandidates = generateCandidates(newState, rng);
  if (newCandidates.length > 0) {
    newState.officials.push(...newCandidates);
    allNotifications.push({
      type: "info",
      title: "Nuevos candidatos disponibles",
      description: `Han surgido ${newCandidates.length} nuevo(s) candidato(s) para cargos publicos. Revisalos en Justicia > Candidatos.`,
    });
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
  // PASO 8: Recalcular indicadores sociales explícitamente
  // Cada indicador se deriva de la eficiencia ministerial real calculada
  // en el paso 5. Se persisten en GameState para que los pasos siguientes
  // (eventos, aprobación, snapshot) usen valores frescos.
  // ═══════════════════════════════════════════════════════════════════════
  newState.povertyRate = calculatePoverty(newState);
  newState.unemploymentRate = calculateUnemployment(newState);
  newState.sickRate = calculateHealth(newState);
  newState.foodSecurity = calculateFoodSecurity(newState);
  newState.crimeRate = calculateCrime(newState);
  newState.educationLevel = calculateEducation(newState);
  newState.inflation = calculateInflationSimple(newState);
  newState.gdp = calculateGDP(newState);

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 9: Avanzar casos judiciales + abrir casos automáticos
  // (produce regimeImpacts que usa el paso 10)
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
  // PASO 9.5: Evaluar mociones del congreso (censura, juicio político)
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
  // PASO 10: Recalcular métricas de régimen + clasificar
  // (se ejecuta antes de eventos para que las métricas estén actualizadas
  //  al evaluar condiciones como subordinación militar para golpes.
  //  regimeImpacts viene del paso 9)
  // ═══════════════════════════════════════════════════════════════════════
  const regimeActions = {
    censorMedia: Object.values(input.mediaActions ?? {}).some(
      (a) => a === "censor" || a === "close"
    ),
    restoreMedia: Object.values(input.mediaActions ?? {}).some(
      (a) => a === "restore"
    ),
    nombrarJuecesAfines: Object.keys(input.appointments ?? {}).some(
      (r) => r === "JUDGE"
    ),
    disolverCongreso: false,
    estadoEmergencia: newState.activeLaws.some(
      (l) => l.lawKey === "estado-emergencia"
    ),
    comprarVotos:
      input.voteBuyingPartyIds !== undefined &&
      input.voteBuyingPartyIds.length > 0,
  };

  const metricsBefore = { ...newState.regimeMetrics };

  newState.regimeMetrics = calculateRegimeMetrics(
    newState.regimeMetrics,
    regimeActions,
    newState.activeLaws,
    newState.organisms,
    regimeImpacts
  );

  newState.regimeMetrics = regenerateRegimeMetrics(
    newState.regimeMetrics,
    metricsBefore
  );

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 11: Disparar eventos aleatorios
  // (se ejecuta ANTES de la aprobación para que los eventos del mes
  //  impacten la aprobación que se calcula en el paso 13)
  // ═══════════════════════════════════════════════════════════════════════
  const { newEvents, notifications: eventNotifications } =
    triggerRandomEvents(newState, rng);

  newState.events.push(...newEvents);
  allNewEvents = newEvents;
  allNotifications.push(...eventNotifications);

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 11b: Aplicar efectos de eventos al estado
  // Las epidemias suben sickRate, los desastres descuentan tesorería,
  // las crisis criminales suben crimeRate, etc.
  // ═══════════════════════════════════════════════════════════════════════
  const eventsThisMonth = newState.events.filter(
    (e) =>
      e.year === newState.currentYear &&
      e.month === newState.currentMonth
  );

  const eventDeltas = applyEventEffects(eventsThisMonth);

  newState.sickRate = Math.max(0, Math.min(100, newState.sickRate + eventDeltas.sickRateDelta));
  newState.crimeRate = Math.max(0, Math.min(100, newState.crimeRate + eventDeltas.crimeRateDelta));
  newState.treasury = Math.max(0, newState.treasury - eventDeltas.treasuryDelta);
  newState.foodSecurity = Math.max(0, Math.min(100, newState.foodSecurity + eventDeltas.foodDelta));
  newState.inflation = Math.max(0, Math.min(100, newState.inflation + eventDeltas.inflationDelta));
  newState.unemploymentRate = Math.max(0, Math.min(100, newState.unemploymentRate + eventDeltas.unemploymentDelta));

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 12: Generar coberturas mediáticas (eventos + decisiones)
  // ═══════════════════════════════════════════════════════════════════════
  allMediaCoverages = generateMediaCoverage(
    newState,
    eventsThisMonth,
    rng
  );

  // Cobertura de decisiones gubernamentales (leyes, presupuestos, organismos, nombramientos)
  const decisionCoverages = generateDecisionCoverage(
    newState,
    input,
    allNewEvents,
    rng
  );
  allMediaCoverages.push(...decisionCoverages);

  // Editoriales de opinión mensuales (una por medio activo)
  const editorialCoverages = generateEditorialCoverage(newState, rng);
  allMediaCoverages.push(...editorialCoverages);

  // Encuestas de opinión simuladas (una por medio activo)
  allMediaPolls = generateMediaPolls(newState, rng);

  // Reportajes de investigación anticorrupción (medios opositores)
  const investigativeResults = generateInvestigativeReports(newState, rng);
  for (const result of investigativeResults) {
    newState.events.push(result.event);
    allNewEvents.push(result.event);
    allMediaCoverages.push(result.coverage);

    // Aplicar reducción de reputación
    const target = newState.officials.find(
      (o) => o.id === result.exposedOfficialId
    );
    if (target) {
      target.reputation = Math.max(
        0,
        target.reputation - result.reputationHit
      );
    }

    // Si dispara caso automático, abrirlo
    if (result.opensCase) {
      const prosecutors = newState.officials.filter(
        (o) => o.role === "PROSECUTOR" && o.status === "ACTIVE"
      );
      const judges = newState.officials.filter(
        (o) => o.role === "JUDGE" && o.status === "ACTIVE"
      );
      if (
        prosecutors.length > 0 &&
        judges.length > 0 &&
        target
      ) {
        const newCase: JudicialCaseState = {
          id: `auto-invest-${newState.currentYear}-${newState.currentMonth}-${result.exposedOfficialId}`,
          defendantOfficialId: result.exposedOfficialId,
          caseType: "CORRUPTION",
          currentPhase: "INVESTIGATION",
          monthsInPhase: 0,
          evidenceStrength: 40 + Math.floor(rng() * 30),
          prosecutorId: prosecutors[0].id,
          judgeId: judges[0].id,
          verdict: null,
          sentenceMonths: null,
        };
        newState.judicialCases.push(newCase);
        if (target) target.status = "INVESTIGATED";
        allNotifications.push({
          type: "case",
          title: "Caso abierto por reportaje",
          description: `Tras el reportaje de investigación, se ha abierto un caso judicial contra ${target.name}.`,
        });
      }
    }

    allNotifications.push({
      type: "warning",
      title: "Reportaje de investigación",
      description: result.event.description,
      severity: result.event.severity,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 12b: Aplicar impacto de coberturas mediáticas a la aprobación
  // Cada cobertura tiene un impactOnApproval por clase social, calculado
  // según el sentimiento y el alcance del medio.
  // ═══════════════════════════════════════════════════════════════════════
  for (const coverage of allMediaCoverages) {
    for (const sc of newState.socialClasses) {
      const impact = coverage.impactOnApproval[sc.key] ?? 0;
      sc.approval = Math.max(0, Math.min(100, sc.approval + impact));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 13: Recalcular aprobación por clase social
  // Ahora se ejecuta DESPUÉS de eventos (paso 11) y coberturas (paso 12),
  // por lo que ambos afectan la aprobación final de cada clase.
  // ═══════════════════════════════════════════════════════════════════════
  for (const sc of newState.socialClasses) {
    sc.approval = calculateApprovalByClass(sc, newState, eventsThisMonth);
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
  // PASO 14: Crear MonthSnapshot
  // ═══════════════════════════════════════════════════════════════════════
  const monthSnapshot = createMonthSnapshot(
    newState,
    newState.currentYear,
    newState.currentMonth
  );

  // ═══════════════════════════════════════════════════════════════════════
  // PASO 15: Evaluar condiciones de fin de partida
  // Lee valores YA calculados (aprobacion, corrupcion, regimen, crimen).
  // No duplica ningun calculo.
  // ═══════════════════════════════════════════════════════════════════════

  // Actualizar contador de meses consecutivos con baja aprobacion (<10%)
  const postApproval = calculateGeneralApproval(newState, eventsThisMonth);
  if (postApproval < 10) {
    newState.consecutiveLowApprovalMonths = (newState.consecutiveLowApprovalMonths ?? 0) + 1;
  } else {
    newState.consecutiveLowApprovalMonths = 0;
  }

  let gameOver = checkGameOverConditions(newState, undefined, allNotifications);

  // Si no hay game over y es mes de elecciones, verificar si gano
  // para generar notificacion de reeleccion y evento
  if (!gameOver) {
    const totalMonths = (newState.currentYear - 1) * 12 + newState.currentMonth;
    if (totalMonths > 0 && totalMonths % 60 === 0 && newState.currentMonth === 0) {
      const result = electionResult(newState);
      if (result.winner) {
        allNotifications.push({
          type: "info",
          title: "Elecciones presidenciales",
          description: `Has sido reelecto con el ${result.votePercent.toFixed(1)}% de los votos. La oposicion obtuvo el ${(100 - result.votePercent).toFixed(1)}%. Inicias un nuevo mandato.`,
        });

        // Evento de eleccion para cobertura mediatica
        const electionEvent = {
          id: `election-${newState.currentYear}-${newState.currentMonth}`,
          type: "OTHER",
          severity: Math.min(100, Math.round(100 - result.votePercent)),
          year: newState.currentYear,
          month: newState.currentMonth,
          description: `Elecciones presidenciales: el mandatario reelecto con ${result.votePercent.toFixed(1)}% de los votos.`,
          effectsApplied: {} as Record<string, unknown>,
          resolvedAt: null,
        };
        newState.events.push(electionEvent);
        allNewEvents.push(electionEvent);
      }
    }
  }

  // Chequeo de asesinato (requiere rng por su naturaleza probabilistica)
  if (!gameOver) {
    gameOver = canBeAssassinated(newState, rng);
  }

  // ── Construir y devolver resultado ─────────────────────────────────────
  return {
    newState,
    monthSnapshot,
    notifications: allNotifications,
    newEvents: allNewEvents,
    mediaCoverages: allMediaCoverages,
    mediaPolls: allMediaPolls,
    gameOver,
  };
}
