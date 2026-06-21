// ─── Cobertura mediática ─────────────────────────────────────────────────────
// Genera coberturas de prensa para cada evento del mes según el sesgo
// de cada medio activo. Funciones puras y deterministas.

import type {
  GameState,
  EventState,
  MediaCoverageData,
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
        mediaId: medium.id,
        headline,
        sentiment: Math.round(sentiment * 1000) / 1000,
        impactOnApproval,
      });
    }
  }

  return coverages;
}
