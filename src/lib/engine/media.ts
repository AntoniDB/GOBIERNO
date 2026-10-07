// ─── Cobertura mediática ─────────────────────────────────────────────────────
// Genera coberturas de prensa para cada evento del mes según el sesgo
// de cada medio activo. Funciones puras y deterministas.

import type {
  GameState,
  EventState,
  MediaCoverageData,
  MediaPollData,
  OfficialState,
} from "./types";
import { BALANCE } from "../balance";

/**
 * Determina si un tipo de evento es negativo para el gobierno.
 */
function isNegativeEvent(eventType: string): boolean {
  const negativeTypes = [
    "EPIDEMIC",
    "SCANDAL",
    "PROTEST",
    "CRIME_SURGE",
    "COUP_ATTEMPT",
    "DISASTER",
    "ECONOMIC_CRISIS",
  ];
  return negativeTypes.includes(eventType);
}

/**
 * Genera un titular descriptivo en español para la cobertura.
 */
function generateHeadline(
  mediaName: string,
  event: EventState,
  sentiment: number
): string {
  const severityLabel =
    event.severity < 30
      ? "leve"
      : event.severity < 60
        ? "moderado"
        : "grave";

  const eventNames: Record<string, string> = {
    EPIDEMIC: "brote epidémico",
    SCANDAL: "escándalo de corrupción",
    PROTEST: "protestas masivas",
    CRIME_SURGE: "ola de criminalidad",
    COUP_ATTEMPT: "intento de golpe de Estado",
    DISASTER: "desastre natural",
    ECONOMIC_CRISIS: "crisis económica",
  };

  const eventName = eventNames[event.type] ?? event.type;

  if (sentiment > 0.3) {
    return `${mediaName}: Gobierno responde eficazmente ante ${eventName} ${severityLabel}`;
  } else if (sentiment < -0.3) {
    return `${mediaName}: Grave crisis por ${eventName} ${severityLabel} evidencia fracaso del gobierno`;
  } else {
    return `${mediaName}: Reportan ${eventName} ${severityLabel} en el país`;
  }
}

/**
 * Genera coberturas mediáticas para todos los eventos del mes,
 * una por cada medio activo.
 *
 * @param state - Estado completo del juego
 * @param eventsThisMonth - Eventos ocurridos este mes
 * @param rng - Función generadora de números aleatorios
 * @returns Lista de coberturas mediáticas generadas
 */
export function generateMediaCoverage(
  state: GameState,
  eventsThisMonth: EventState[],
  rng: () => number
): MediaCoverageData[] {
  const coverages: MediaCoverageData[] = [];

  // Solo medios activos
  const activeMedia = state.media.filter((m) => m.status === "ACTIVE");
  if (activeMedia.length === 0 || eventsThisMonth.length === 0) {
    return coverages;
  }

  for (const medium of activeMedia) {
    for (const event of eventsThisMonth) {
      // ── Calcular sentimiento base ───────────────────────────────────────
      // Sentimiento = afinidadGubernamental / 100 * FACTOR + ruido aleatorio
      const noise = (rng() - 0.5) * 0.2; // ruido en [-0.1, 0.1]
      let sentiment =
        (medium.governmentAffinity / 100) *
        BALANCE.MEDIA_AFFINITY_SENTIMENT_FACTOR +
        noise;

      // ── Sesgo por afinidad ──────────────────────────────────────────────
      const eventIsNegative = isNegativeEvent(event.type);
      const eventIsPositive = !eventIsNegative;

      // Medio afín al gobierno (>30) minimiza cobertura negativa
      if (medium.governmentAffinity > 30 && eventIsNegative) {
        sentiment = Math.max(sentiment, -0.15);
        sentiment = Math.min(sentiment, 0.05); // ligeramente positivo o neutro
      }

      // Medio opositor (<-30) minimiza cobertura positiva
      if (medium.governmentAffinity < -30 && eventIsPositive) {
        sentiment = Math.min(sentiment, 0.15);
        sentiment = Math.max(sentiment, -0.05); // ligeramente negativo o neutro
      }

      // ── Calcular impacto en aprobación por clase social ───────────────
      // impactOnApproval = { claseKey: sentiment * alcance/100 * credibilidad/100 * 5 }
      const impactOnApproval: Record<string, number> = {};
      const impactBase =
        sentiment * (medium.reach / 100) * (medium.credibility / 100) * 5;

      for (const sc of state.socialClasses) {
        // Clases con más educación son más influenciadas por medios creíbles
        const educationModifier = 0.5 + (sc.educationLevel / 100) * 0.5;
        impactOnApproval[sc.key] =
          Math.round(impactBase * educationModifier * 100) / 100;
      }

      // ── Generar titular ────────────────────────────────────────────────
      const headline = generateHeadline(medium.name, event, sentiment);

      coverages.push({
        id: `mc-${state.currentYear}-${state.currentMonth}-${medium.id}-${event.id}`,
        mediaId: medium.id,
        headline,
        sentiment: Math.round(sentiment * 1000) / 1000,
        impactOnApproval,
      });
    }
  }

  return coverages;
}

/**
 * Genera coberturas mediáticas para decisiones gubernamentales del mes.
 * Cubre: leyes aprobadas, cambios de presupuesto significativos,
 * organismos creados, y nombramientos ministeriales.
 *
 * El sesgo editorial se aplica igual que en la cobertura de eventos.
 */
export function generateDecisionCoverage(
  state: GameState,
  input: {
    proposedLaws?: string[];
    budgetAdjustments?: Record<string, number>;
    newOrganisms?: Record<string, { name: string; monthlyBudget: number; headOfficialId?: string; staff?: number; autonomyLevel?: number }>;
    appointments?: Record<string, string>;
  },
  newEvents: EventState[],
  rng: () => number,
): MediaCoverageData[] {
  const coverages: MediaCoverageData[] = [];
  const activeMedia = state.media.filter((m) => m.status === "ACTIVE");
  if (activeMedia.length === 0) return coverages;

  let decisionIndex = 0;

  // ── Leyes propuestas este mes ──────────────────────────────────────────
  if (input.proposedLaws && input.proposedLaws.length > 0) {
    for (const lawKey of input.proposedLaws) {
      const lawApproved = newEvents.some(
        (e) => e.description.includes(lawKey) || e.description.includes("ley")
      );

      for (const medium of activeMedia) {
        const sentiment = computeDecisionSentiment(medium, true, rng);
        const impactOnApproval = computeDecisionImpact(state, medium, sentiment);
        const headline = lawApproved
          ? `${medium.name}: Gobierno aprueba ley — ${lawKey.replace(/-/g, " ")}`
          : `${medium.name}: Congreso debate propuesta de ley — ${lawKey.replace(/-/g, " ")}`;

        coverages.push({
          id: `mc-dec-${state.currentYear}-${state.currentMonth}-${medium.id}-${decisionIndex}`,
          mediaId: medium.id,
          headline,
          sentiment: Math.round(sentiment * 1000) / 1000,
          impactOnApproval,
        });
        decisionIndex++;
      }
    }
  }

  // ── Cambios de presupuesto significativos (>5% de cambio) ──────────────
  if (input.budgetAdjustments) {
    for (const [ministryKey, newPercent] of Object.entries(input.budgetAdjustments)) {
      const ministry = state.ministries.find((m) => m.key === ministryKey);
      if (!ministry) continue;
      const delta = Math.abs(newPercent - ministry.budgetPercent);
      if (delta < 5) continue;

      for (const medium of activeMedia) {
        const isIncrease = newPercent > ministry.budgetPercent;
        const sentiment = computeDecisionSentiment(medium, isIncrease, rng);
        const impactOnApproval = computeDecisionImpact(state, medium, sentiment);
        const directionLabel = isIncrease ? "aumenta" : "reduce";
        const ministryNames: Record<string, string> = {
          salud: "Salud", educacion: "Educación", economia: "Economía",
          defensa: "Defensa", seguridad: "Seguridad", justicia: "Justicia",
          agricultura: "Agricultura", desarrollo_social: "Desarrollo Social",
        };
        const ministryName = ministryNames[ministryKey] ?? ministryKey;

        coverages.push({
          id: `mc-dec-${state.currentYear}-${state.currentMonth}-${medium.id}-${decisionIndex}`,
          mediaId: medium.id,
          headline: `${medium.name}: Gobierno ${directionLabel} presupuesto de ${ministryName} en ${delta.toFixed(0)}%`,
          sentiment: Math.round(sentiment * 1000) / 1000,
          impactOnApproval,
        });
        decisionIndex++;
      }
    }
  }

  // ── Organismos creados este mes ────────────────────────────────────────
  if (input.newOrganisms) {
    for (const [, config] of Object.entries(input.newOrganisms)) {
      for (const medium of activeMedia) {
        const sentiment = computeDecisionSentiment(medium, true, rng);
        const impactOnApproval = computeDecisionImpact(state, medium, sentiment);

        coverages.push({
          id: `mc-dec-${state.currentYear}-${state.currentMonth}-${medium.id}-${decisionIndex}`,
          mediaId: medium.id,
          headline: `${medium.name}: Gobierno crea nuevo organismo — ${config.name}`,
          sentiment: Math.round(sentiment * 1000) / 1000,
          impactOnApproval,
        });
        decisionIndex++;
      }
    }
  }

  // ── Nombramientos ministeriales este mes ───────────────────────────────
  if (input.appointments) {
    for (const [ministryKey] of Object.entries(input.appointments)) {
      const ministry = state.ministries.find((m) => m.key === ministryKey);
      if (!ministry) continue;
      const minister = state.officials.find(
        (o) => o.id === ministry.ministerOfficialId
      );

      for (const medium of activeMedia) {
        const sentiment = computeDecisionSentiment(medium, true, rng);
        const impactOnApproval = computeDecisionImpact(state, medium, sentiment);
        const ministerName = minister?.name ?? "nuevo titular";

        coverages.push({
          id: `mc-dec-${state.currentYear}-${state.currentMonth}-${medium.id}-${decisionIndex}`,
          mediaId: medium.id,
          headline: `${medium.name}: ${ministerName} asume como nuevo titular de la cartera`,
          sentiment: Math.round(sentiment * 1000) / 1000,
          impactOnApproval,
        });
        decisionIndex++;
      }
    }
  }

  return coverages;
}

/**
 * Calcula el sentimiento para una decisión gubernamental según la afinidad
 * del medio. Las decisiones "positivas" (aumentos, creaciones) son tratadas
 * como eventos positivos; las "negativas" (recortes) como negativos.
 */
function computeDecisionSentiment(
  medium: { governmentAffinity: number },
  isPositiveAction: boolean,
  rng: () => number,
): number {
  const noise = (rng() - 0.5) * 0.2;
  let sentiment =
    (medium.governmentAffinity / 100) *
    BALANCE.MEDIA_AFFINITY_SENTIMENT_FACTOR +
    noise;

  // Medio afín: enfatiza decisiones positivas, minimiza recortes
  if (medium.governmentAffinity > 30) {
    if (isPositiveAction) {
      sentiment = Math.max(0.1, Math.min(0.5, sentiment + 0.15));
    } else {
      sentiment = Math.max(-0.15, Math.min(0.1, sentiment - 0.1));
    }
  }

  // Medio opositor: critica recortes, minimiza logros
  if (medium.governmentAffinity < -30) {
    if (isPositiveAction) {
      sentiment = Math.max(-0.15, Math.min(0.15, sentiment - 0.1));
    } else {
      sentiment = Math.max(-0.5, Math.min(-0.05, sentiment - 0.15));
    }
  }

  return sentiment;
}

/**
 * Calcula el impacto en aprobación por clase social para una cobertura
 * de decisión gubernamental.
 */
function computeDecisionImpact(
  state: GameState,
  medium: { reach: number; credibility: number },
  sentiment: number,
): Record<string, number> {
  const impactOnApproval: Record<string, number> = {};
  const impactBase =
    sentiment * (medium.reach / 100) * (medium.credibility / 100) * 4;

  for (const sc of state.socialClasses) {
    const educationModifier = 0.5 + (sc.educationLevel / 100) * 0.5;
    impactOnApproval[sc.key] =
      Math.round(impactBase * educationModifier * 100) / 100;
  }

  return impactOnApproval;
}

/**
 * Genera una editorial de opinión por cada medio activo cada mes.
 * La editorial refleja la línea editorial del medio sobre la situación
 * general del país basada en los indicadores del mes.
 *
 * El sentimiento se calcula a partir de:
 * - Aprobación general (peso 40%)
 * - Indicadores económicos (peso 30%)
 * - Corrupción (peso 30%)
 *
 * Modulado por la afinidad gubernamental del medio.
 */
export function generateEditorialCoverage(
  state: GameState,
  rng: () => number,
): MediaCoverageData[] {
  const coverages: MediaCoverageData[] = [];
  const activeMedia = state.media.filter((m) => m.status === "ACTIVE");
  if (activeMedia.length === 0) return coverages;

  // Calcular el estado general del país (0-100, más alto = mejor)
  const economyHealth = Math.max(0, 100 - state.inflation * 2 - state.unemploymentRate);
  const normalizedEconomy = Math.max(0, Math.min(100, economyHealth));

  // Aprobación general = promedio ponderado de las clases sociales
  const generalApproval = state.socialClasses.reduce(
    (sum, sc) => sum + sc.approval * (sc.populationPercent / 100),
    0
  );

  // Corrupción global = promedio de funcionarios activos
  const activeOfficials = state.officials.filter((o) => o.status === "ACTIVE");
  const globalCorruption =
    activeOfficials.length > 0
      ? activeOfficials.reduce((sum, o) => sum + o.corruption, 0) / activeOfficials.length
      : 0;

  const countryHealth =
    generalApproval * BALANCE.MEDIA_EDITORIAL_APPROVAL_WEIGHT +
    normalizedEconomy * BALANCE.MEDIA_EDITORIAL_ECONOMY_WEIGHT +
    (100 - globalCorruption) * BALANCE.MEDIA_EDITORIAL_CORRUPTION_WEIGHT;

  for (const medium of activeMedia) {
    // Sentimiento base: qué tan bien está el país según los datos
    const baseSentiment = (countryHealth - 50) / 50; // [-1, 1]

    // Sesgo editorial: medio afín ve el país mejor, opositor peor
    const bias = (medium.governmentAffinity / 100) * 0.3;
    const noise = (rng() - 0.5) * 0.15;
    const sentiment = Math.max(-1, Math.min(1, baseSentiment + bias + noise));

    // Impacto en aprobación por clase
    const impactOnApproval: Record<string, number> = {};
    const impactBase =
      sentiment * (medium.reach / 100) * (medium.credibility / 100) *
      BALANCE.MEDIA_EDITORIAL_MAX_IMPACT;

    for (const sc of state.socialClasses) {
      const educationModifier = 0.5 + (sc.educationLevel / 100) * 0.5;
      impactOnApproval[sc.key] =
        Math.round(impactBase * educationModifier * 100) / 100;
    }

    // Generar titular editorial
    let headline: string;
    if (sentiment > 0.25) {
      headline = `${medium.name} — Editorial: El país avanza — balance positivo del mes`;
    } else if (sentiment < -0.25) {
      headline = `${medium.name} — Editorial: Preocupa el rumbo del país — urge rectificar`;
    } else {
      headline = `${medium.name} — Editorial: Claroscuros en el balance mensual del gobierno`;
    }

    coverages.push({
      id: `mc-edit-${state.currentYear}-${state.currentMonth}-${medium.id}`,
      mediaId: medium.id,
      headline,
      sentiment: Math.round(sentiment * 1000) / 1000,
      impactOnApproval,
    });
  }

  return coverages;
}

/**
 * Genera encuestas de opinión simuladas para cada medio activo.
 * Cada medio publica su propia encuesta de aprobación con sesgo
 * según su afinidad gubernamental.
 *
 * Pro-gobierno: infla la aprobación real
 * Opositor: la reduce
 * Neutral: se acerca al valor real con poco ruido
 */
export function generateMediaPolls(
  state: GameState,
  rng: () => number,
): MediaPollData[] {
  const polls: MediaPollData[] = [];
  const activeMedia = state.media.filter((m) => m.status === "ACTIVE");
  if (activeMedia.length === 0) return polls;

  // Aprobación real = promedio ponderado de clases sociales
  const realApproval = state.socialClasses.reduce(
    (sum, sc) => sum + sc.approval * (sc.populationPercent / 100),
    0
  );

  // Corrupción global real
  const activeOfficials = state.officials.filter((o) => o.status === "ACTIVE");
  const realCorruption =
    activeOfficials.length > 0
      ? activeOfficials.reduce((sum, o) => sum + o.corruption, 0) / activeOfficials.length
      : 0;

  for (const medium of activeMedia) {
    // Sesgo: medio afín reporta aprobación más alta, opositor más baja
    const bias = (medium.governmentAffinity / 100) * 15;
    const noise = (rng() - 0.5) * 6; // ruido [-3, 3]

    const polledApproval = Math.max(0, Math.min(100, realApproval + bias + noise));
    const polledCorruption = Math.max(0, Math.min(100, realCorruption - bias * 0.5 + (rng() - 0.5) * 8));

    polls.push({
      mediaId: medium.id,
      mediaName: medium.name,
      approvalPoll: Math.round(polledApproval * 10) / 10,
      corruptionPoll: Math.round(polledCorruption * 10) / 10,
      credibility: medium.credibility,
      governmentAffinity: medium.governmentAffinity,
    });
  }

  return polls;
}

/**
 * Resultado de un reportaje de investigación: expone corrupción de un
 * funcionario cuando hay corrupción alta + prensa libre.
 */
export interface InvestigativeReportResult {
  event: EventState;
  coverage: MediaCoverageData;
  exposedOfficialId: string;
  reputationHit: number;
  opensCase: boolean;
}

/**
 * Genera reportajes de investigación anticorrupción.
 * Condiciones: corrupción global > 40, libertad de prensa > 50.
 * Solo medios opositores (governmentAffinity < 0) pueden publicarlos.
 * Si la prensa está censurada, no se generan.
 */
export function generateInvestigativeReports(
  state: GameState,
  rng: () => number,
): InvestigativeReportResult[] {
  const results: InvestigativeReportResult[] = [];

  // Calcular corrupción global
  const activeOfficials = state.officials.filter(
    (o) => o.status === "ACTIVE"
  );
  const globalCorruption =
    activeOfficials.length > 0
      ? activeOfficials.reduce((sum, o) => sum + o.corruption, 0) /
        activeOfficials.length
      : 0;

  // Verificar condiciones
  if (
    globalCorruption < BALANCE.MEDIA_INVESTIGATIVE_CORRUPTION_THRESHOLD ||
    state.regimeMetrics.pressFreedom <
      BALANCE.MEDIA_INVESTIGATIVE_PRESS_FREEDOM_THRESHOLD
  ) {
    return results;
  }

  // Medios opositores activos que pueden publicar reportajes
  const investigativeMedia = state.media.filter(
    (m) =>
      m.status === "ACTIVE" &&
      m.governmentAffinity < 0
  );

  if (investigativeMedia.length === 0) return results;

  // Funcionarios con corrupción > 30 que pueden ser expuestos
  const exposedOfficials = state.officials.filter(
    (o) => o.corruption > 30 && o.status === "ACTIVE"
  );

  if (exposedOfficials.length === 0) return results;

  // Probabilidad por medio: cada medio opositor puede publicar
  for (const medium of investigativeMedia) {
    if (rng() >= BALANCE.MEDIA_INVESTIGATIVE_PROB) continue;

    // Seleccionar funcionario al azar para exponer
    const targetIdx = Math.floor(rng() * exposedOfficials.length);
    const target = exposedOfficials[targetIdx];

    // Bonus de credibilidad para el medio
    medium.credibility = Math.min(
      100,
      medium.credibility + BALANCE.MEDIA_INVESTIGATIVE_CREDIBILITY_BONUS
    );

    // Reducir reputación del funcionario
    const reputationHit = BALANCE.MEDIA_INVESTIGATIVE_REPUTATION_HIT;
    target.reputation = Math.max(0, target.reputation - reputationHit);

    // ¿Dispara apertura de caso?
    const opensCase =
      rng() < BALANCE.MEDIA_INVESTIGATIVE_CASE_PROB;

    // Generar evento LEAK
    const event: EventState = {
      id: `invest-${state.currentYear}-${state.currentMonth}-${medium.id}-${target.id}`,
      type: "LEAK",
      severity: Math.min(100, Math.round(target.corruption * 0.8 + rng() * 20)),
      year: state.currentYear,
      month: state.currentMonth,
      description: `Reportaje de investigación de ${medium.name} expone corrupción de ${target.name} (${target.role}). El funcionario tenía un nivel de corrupción del ${Math.round(target.corruption)}%.`,
      effectsApplied: {
        exposedOfficialId: target.id,
        reputationHit,
        mediaCredibilityBonus: BALANCE.MEDIA_INVESTIGATIVE_CREDIBILITY_BONUS,
        opensCase,
      },
      resolvedAt: null,
    };

    // Generar cobertura (el reportaje en sí es la cobertura)
    const impactOnApproval: Record<string, number> = {};
    const sentiment = -0.5; // Siempre negativo para el gobierno
    const impactBase =
      sentiment * (medium.reach / 100) * (medium.credibility / 100) * 6;

    for (const sc of state.socialClasses) {
      const educationModifier = 0.5 + (sc.educationLevel / 100) * 0.5;
      impactOnApproval[sc.key] =
        Math.round(impactBase * educationModifier * 100) / 100;
    }

    const coverage: MediaCoverageData = {
      id: `mc-invest-${state.currentYear}-${state.currentMonth}-${medium.id}-${target.id}`,
      mediaId: medium.id,
      headline: `${medium.name} — INVESTIGACIÓN: ${target.name} implicado en graves actos de corrupción`,
      sentiment: Math.round(sentiment * 1000) / 1000,
      impactOnApproval,
    };

    results.push({
      event,
      coverage,
      exposedOfficialId: target.id,
      reputationHit,
      opensCase,
    });
  }

  return results;
}
