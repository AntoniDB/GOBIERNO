// ─── Sistema de eventos aleatorios ───────────────────────────────────────────
// Dispara eventos basados en umbrales y probabilidades del estado.
// Funciones puras y deterministas: mismo estado + misma semilla = mismos eventos.

import type {
  GameState,
  EventState,
  TurnNotification,
} from "./types";
import { BALANCE } from "../balance";
import { calculateGeneralApproval } from "./approval";

/**
 * Deltas acumulados de efectos de eventos sobre el estado del juego.
 */
export interface EventEffectsDelta {
  sickRateDelta: number;
  crimeRateDelta: number;
  treasuryDelta: number;
  foodDelta: number;
  inflationDelta: number;
  unemploymentDelta: number;
}

/**
 * Genera una descripción en español para cada tipo de evento.
 */
function getEventDescription(
  type: string,
  severity: number
): string {
  const severityLabel =
    severity < 30 ? "leve" : severity < 60 ? "moderado" : "grave";
  switch (type) {
    case "EPIDEMIC":
      return `Brote epidémico ${severityLabel} afecta la salud pública. Severidad: ${Math.round(severity)}%.`;
    case "SCANDAL":
      return `Escándalo de corrupción ${severityLabel} sacude al gobierno. Severidad: ${Math.round(severity)}%.`;
    case "PROTEST":
      return `Protestas ${severityLabel}s estallan por descontento social. Severidad: ${Math.round(severity)}%.`;
    case "CRIME_SURGE":
      return `Ola de criminalidad ${severityLabel} azota el país. Severidad: ${Math.round(severity)}%.`;
    case "COUP_ATTEMPT":
      return `Intento de golpe de Estado ${severityLabel}. Severidad: ${Math.round(severity)}%.`;
    case "DISASTER":
      return `Desastre natural ${severityLabel} causa estragos. Severidad: ${Math.round(severity)}%.`;
    case "ECONOMIC_CRISIS":
      return `Crisis económica ${severityLabel} golpea las finanzas. Severidad: ${Math.round(severity)}%.`;
    default:
      return `Evento ${type} (severidad: ${Math.round(severity)}%).`;
  }
}

/**
 * Genera los efectos aplicados de un evento según su tipo y severidad.
 */
function getEventEffects(
  type: string,
  severity: number,
  population: number
): Record<string, unknown> {
  switch (type) {
    case "EPIDEMIC":
      return {
        sickRateIncrease: Math.round(severity * 2),
        healthMinistryPenalty: -Math.round(severity),
        treasuryCost: Math.round(severity * population * 0.5),
      };
    case "SCANDAL":
      return {
        corruptionIncrease: Math.round(severity * 0.5),
        approvalPenalty: -Math.round(severity),
        reputationDamage: Math.round(severity * 0.8),
      };
    case "PROTEST":
      return {
        crimeRateIncrease: Math.round(severity * 0.5),
        approvalPenalty: -Math.round(severity),
        economicDisruption: Math.round(severity * 0.3),
      };
    case "CRIME_SURGE":
      return {
        crimeRateIncrease: Math.round(severity * 2),
        securityPressure: Math.round(severity),
      };
    case "COUP_ATTEMPT":
      return {
        militarySubordinationPenalty: -Math.round(severity * 3),
        approvalPenalty: -Math.round(severity * 2),
        stabilityDamage: Math.round(severity * 2),
      };
    case "DISASTER":
      return {
        treasuryCost: Math.round(severity * population * 2),
        foodSecurityPenalty: -Math.round(severity),
        infrastructureDamage: Math.round(severity * 1.5),
      };
    case "ECONOMIC_CRISIS":
      return {
        treasuryCost: Math.round(severity * population * 5),
        inflationIncrease: Math.round(severity),
        unemploymentIncrease: Math.round(severity * 0.5),
        gdpPenalty: -Math.round(severity * BALANCE.GDP_CRISIS_PENALTY / 100),
      };
    default:
      return { severity };
  }
}

/**
 * Evalúa y dispara eventos aleatorios según las condiciones del estado.
 *
 * @param state - Estado completo del juego
 * @param rng - Función generadora de números aleatorios
 * @returns Nuevos eventos creados y notificaciones generadas
 */
export function triggerRandomEvents(
  state: GameState,
  rng: () => number
): {
  newEvents: EventState[];
  notifications: TurnNotification[];
} {
  const newEvents: EventState[] = [];
  const notifications: TurnNotification[] = [];

  // Calcular indicadores necesarios para evaluar umbrales
  const povertyRate = state.socialClasses
    .filter((c) => c.key === "POVERTY" || c.key === "EXTREME_POVERTY")
    .reduce((sum, c) => sum + c.populationPercent, 0);

  const healthMinistry = state.ministries.find(
    (m) => m.key === "SALUD" || m.key === "HEALTH"
  );
  const healthImpact = healthMinistry
    ? healthMinistry.efficiency * (1 - Math.exp(-healthMinistry.budgetPercent / 12))
    : 25;

  const securityMinistry = state.ministries.find(
    (m) => m.key === "SEGURIDAD" || m.key === "SECURITY"
  );
  const securityImpact = securityMinistry
    ? securityMinistry.efficiency * (1 - Math.exp(-securityMinistry.budgetPercent / 12))
    : 25;

  // Corrupción global: promedio de corrupción de funcionarios
  const avgCorruption =
    state.officials.length > 0
      ? state.officials.reduce((s, o) => s + o.corruption, 0) /
        state.officials.length
      : 0;

  // Aprobación de clases bajas (POVERTY)
  const povertyClass = state.socialClasses.find(
    (c) => c.key === "POVERTY"
  );
  const povertyApproval = povertyClass?.approval ?? 50;

  // Aprobación general (promedio ponderado por población de las 4 clases)
  const generalApproval = calculateGeneralApproval(state, []);

  // Subordinación militar: de las métricas de régimen
  const militarySub = state.regimeMetrics.militarySubordination;

  // Crimen: aproximado por eficiencia de Seguridad
  const crimeRate = Math.max(
    0,
    Math.min(100, BALANCE.CRIME_BASE - BALANCE.CRIME_SECURITY_FACTOR * securityImpact)
  );

  // Inflación: estimación simple
  const inflation = BALANCE.BASE_INFLATION;

  // ── Verificar si alguna clase social cumple condiciones de protesta ─────
  const classProtestCondition = state.socialClasses.some(
    (sc) =>
      sc.approval < BALANCE.PROTEST_CLASS_APPROVAL_THRESHOLD &&
      sc.populationPercent > BALANCE.PROTEST_CLASS_POPULATION_THRESHOLD
  );

  // ── Evaluar cada tipo de evento contra sus condiciones ─────────────────
  const eventChecks: {
    type: string;
    condition: boolean;
    baseProb: number;
    severityFn: () => number;
  }[] = [
    {
      type: "EPIDEMIC",
      condition: healthImpact < BALANCE.EVENT_EPIDEMIC_HEALTH_THRESHOLD,
      baseProb: BALANCE.EVENT_EPIDEMIC_PROB,
      severityFn: () =>
        Math.min(
          100,
          ((BALANCE.EVENT_EPIDEMIC_HEALTH_THRESHOLD - healthImpact) /
            BALANCE.EVENT_EPIDEMIC_HEALTH_THRESHOLD) *
            100
        ),
    },
    {
      type: "SCANDAL",
      condition: avgCorruption > BALANCE.EVENT_SCANDAL_CORRUPTION_THRESHOLD,
      baseProb: BALANCE.EVENT_SCANDAL_PROB,
      severityFn: () => Math.min(100, avgCorruption * 1.2),
    },
    {
      type: "PROTEST",
      condition:
        povertyRate > BALANCE.EVENT_PROTEST_POVERTY_THRESHOLD ||
        povertyApproval < BALANCE.EVENT_PROTEST_APPROVAL_THRESHOLD ||
        classProtestCondition,
      baseProb: BALANCE.EVENT_PROTEST_PROB,
      severityFn: () => {
        const povertyFactor = Math.max(0, povertyRate - 30) / 70;
        const approvalFactor = Math.max(0, 50 - povertyApproval) / 50;
        // Factor adicional por clase en crisis
        const classCrisisFactor = classProtestCondition
          ? state.socialClasses.reduce((max, sc) => {
              if (
                sc.approval < BALANCE.PROTEST_CLASS_APPROVAL_THRESHOLD &&
                sc.populationPercent > BALANCE.PROTEST_CLASS_POPULATION_THRESHOLD
              ) {
                const factor =
                  (BALANCE.PROTEST_CLASS_APPROVAL_THRESHOLD - sc.approval) / 20 +
                  (sc.populationPercent - BALANCE.PROTEST_CLASS_POPULATION_THRESHOLD) / 75;
                return Math.max(max, factor);
              }
              return max;
            }, 0)
          : 0;
        return Math.min(100, (povertyFactor + approvalFactor + classCrisisFactor) * 50);
      },
    },
    {
      type: "CRIME_SURGE",
      condition: crimeRate > BALANCE.EVENT_CRIME_SURGE_THRESHOLD,
      baseProb: BALANCE.EVENT_CRIME_SURGE_PROB,
      severityFn: () => Math.min(100, crimeRate * 1.3),
    },
    {
      type: "COUP_ATTEMPT",
      condition:
        generalApproval < BALANCE.EVENT_COUP_APPROVAL_THRESHOLD &&
        militarySub < 40,
      baseProb: BALANCE.EVENT_COUP_PROB,
      severityFn: () => {
        const approvalFactor =
          (BALANCE.EVENT_COUP_APPROVAL_THRESHOLD - generalApproval) /
          BALANCE.EVENT_COUP_APPROVAL_THRESHOLD;
        const militaryFactor = (40 - militarySub) / 40;
        return Math.min(100, (approvalFactor + militaryFactor) * 50);
      },
    },
    {
      type: "DISASTER",
      condition: true, // probabilidad constante
      baseProb: BALANCE.EVENT_DISASTER_PROB,
      severityFn: () => 20 + rng() * 60, // severidad aleatoria 20-80
    },
    {
      type: "ECONOMIC_CRISIS",
      condition: inflation > BALANCE.EVENT_ECONOMIC_CRISIS_INFLATION,
      baseProb: 0.1,
      severityFn: () => Math.min(100, inflation * 5),
    },
  ];

  let eventIndex = 0;
  for (const check of eventChecks) {
    if (!check.condition) continue;

    const prob = check.baseProb * (1 + (check.severityFn() / 100) * 0.5);
    if (rng() < prob) {
      const severity = Math.round(check.severityFn());
      const description = getEventDescription(check.type, severity);
      const effects = getEventEffects(
        check.type,
        severity,
        state.population
      );

      const event: EventState = {
        id: `evt-${state.currentYear}-${state.currentMonth}-${check.type}-${eventIndex}`,
        type: check.type,
        severity,
        year: state.currentYear,
        month: state.currentMonth,
        description,
        effectsApplied: effects,
        resolvedAt: null,
      };

      newEvents.push(event);
      eventIndex++;

      // Determinar tipo de notificación según el evento
      const notifType: TurnNotification["type"] =
        check.type === "COUP_ATTEMPT" ||
        check.type === "ECONOMIC_CRISIS" ||
        check.type === "DISASTER"
          ? "crisis"
          : check.type === "SCANDAL" || check.type === "PROTEST"
            ? "warning"
            : "event";

      notifications.push({
        type: notifType,
        title: `Evento: ${check.type}`,
        description,
        severity: severity / 100,
      });
    }
  }

  return { newEvents, notifications };
}

/**
 * Aplica los efectos de los eventos del mes al estado del juego.
 * Lee effectsApplied de cada evento y acumula los deltas para cada indicador.
 *
 * @param events - Eventos ocurridos este mes
 * @returns Deltas acumulados para aplicar al GameState
 */
export function applyEventEffects(
  events: EventState[]
): EventEffectsDelta {
  const deltas: EventEffectsDelta = {
    sickRateDelta: 0,
    crimeRateDelta: 0,
    treasuryDelta: 0,
    foodDelta: 0,
    inflationDelta: 0,
    unemploymentDelta: 0,
  };

  for (const event of events) {
    const eff = event.effectsApplied as Record<string, number>;

    if (typeof eff.sickRateIncrease === "number") {
      deltas.sickRateDelta += eff.sickRateIncrease;
    }
    if (typeof eff.crimeRateIncrease === "number") {
      deltas.crimeRateDelta += eff.crimeRateIncrease;
    }
    if (typeof eff.treasuryCost === "number") {
      deltas.treasuryDelta += eff.treasuryCost;
    }
    if (typeof eff.foodSecurityPenalty === "number") {
      deltas.foodDelta += eff.foodSecurityPenalty;
    }
    if (typeof eff.inflationIncrease === "number") {
      deltas.inflationDelta += eff.inflationIncrease;
    }
    if (typeof eff.unemploymentIncrease === "number") {
      deltas.unemploymentDelta += eff.unemploymentIncrease;
    }
  }

  return deltas;
}
