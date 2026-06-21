// ─── Métricas de régimen y clasificación ─────────────────────────────────────
// Calcula las métricas del régimen político y clasifica el tipo de régimen.
// Funciones puras y deterministas.

import type { RegimeMetricsState, ActiveLawState, OrganismState } from "./types";
import { BALANCE } from "../balance";

// ─── Clamp helper ─────────────────────────────────────────────────────────────

const REGIME_KEYS: (keyof RegimeMetricsState)[] = [
  "powerConcentration",
  "pressFreedom",
  "judicialIndependence",
  "politicalPluralism",
  "civilLiberties",
  "transparency",
  "militarySubordination",
];

function clampMetrics(metrics: RegimeMetricsState): RegimeMetricsState {
  const result = { ...metrics };
  for (const key of REGIME_KEYS) {
    result[key] = Math.max(0, Math.min(100, Math.round(result[key] * 10) / 10));
  }
  return result;
}

// ─── Cálculo de métricas por acciones del jugador ─────────────────────────────

/**
 * Aplica los modificadores de acciones del jugador, leyes activas,
 * organismos y veredictos judiciales a las métricas de régimen.
 *
 * @param metrics - Métricas actuales del régimen
 * @param actions - Acciones realizadas este turno que afectan el régimen
 * @param activeLaws - Leyes activas con effectsJson que impactan métricas
 * @param organisms - Organismos existentes (autonomía determina efecto)
 * @param regimeImpacts - Impactos provenientes de otros módulos (ej. justicia)
 * @returns Nuevas métricas con modificadores aplicados, clamp a [0, 100]
 */
export function calculateRegimeMetrics(
  metrics: RegimeMetricsState,
  actions: {
    censorMedia?: boolean;
    nombrarJuecesAfines?: boolean;
    disolverCongreso?: boolean;
    estadoEmergencia?: boolean;
    comprarVotos?: boolean;
    restoreMedia?: boolean;
  },
  activeLaws: ActiveLawState[] = [],
  organisms: OrganismState[] = [],
  regimeImpacts: { type: string; value: number }[] = []
): RegimeMetricsState {
  const result = { ...metrics };

  // ── Censura de medios: reduce libertad de prensa, concentra poder ──────
  if (actions.censorMedia) {
    result.pressFreedom += BALANCE.REGIME_CENSOR_PRESS_PENALTY;
    result.powerConcentration += BALANCE.REGIME_CENSOR_POWER_BONUS;
  }

  // ── Restauración de medios: recupera libertad de prensa ────────────────
  if (actions.restoreMedia) {
    result.pressFreedom += BALANCE.MEDIA_RESTORE_PRESS_FREEDOM_BONUS;
    result.powerConcentration += BALANCE.MEDIA_RESTORE_POWER_CONCENTRATION_PENALTY;
  }

  // ── Nombrar jueces afines: reduce independencia judicial ───────────────
  if (actions.nombrarJuecesAfines) {
    result.judicialIndependence += BALANCE.REGIME_NOMBRAR_JUECES_AFINES.judicial;
    result.powerConcentration +=
      BALANCE.REGIME_NOMBRAR_JUECES_AFINES.powerConcentration;
  }

  // ── Disolver congreso: reduce pluralismo, concentra poder ──────────────
  if (actions.disolverCongreso) {
    result.politicalPluralism += BALANCE.REGIME_DISOLVER_CONGRESO.pluralism;
    result.powerConcentration += BALANCE.REGIME_DISOLVER_CONGRESO.powerConcentration;
  }

  // ── Estado de emergencia mensual: reduce libertades civiles ────────────
  if (actions.estadoEmergencia) {
    result.civilLiberties += BALANCE.REGIME_ESTADO_EMERGENCIA_MENSUAL.civilLiberties;
  }

  // ── Comprar votos: reduce transparencia ────────────────────────────────
  if (actions.comprarVotos) {
    result.transparency += BALANCE.REGIME_COMPRAR_VOTOS.transparency;
  }

  // ── Efectos de leyes activas sobre métricas de régimen ─────────────────
  // Cada ley puede tener keys del effectsJson que correspondan a métricas.
  // Ej: ley "ley-transparencia" → effectsJson.transparency: 20
  for (const law of activeLaws) {
    const effects = law.effectsJson as Record<string, unknown>;
    for (const metricKey of BALANCE.REGIME_LAW_EFFECT_KEYS) {
      const rawValue = effects[metricKey];
      if (typeof rawValue === "number") {
        // powerConcentration se suma (más concentración = peor)
        // Las demás métricas "buenas" (pressFreedom, etc.) también se suman directamente
        result[metricKey as keyof RegimeMetricsState] += rawValue;
      }
    }
  }

  // ── Efectos de organismos autónomos ────────────────────────────────────
  for (const org of organisms) {
    if (org.type === "COMPTROLLER" && org.autonomyLevel > 70) {
      // Contraloría con autonomía alta: +15 transparencia, +5 independencia judicial
      result.transparency += BALANCE.REGIME_CONTRALORIA_AUTONOMA.transparency;
      result.judicialIndependence += BALANCE.REGIME_CONTRALORIA_AUTONOMA.judicial;
    }
    if (org.type === "OMBUDSMAN" && org.autonomyLevel > 70) {
      // Defensoría del Pueblo autónoma: +15 libertades civiles
      result.civilLiberties += BALANCE.REGIME_DEFENSORIA_AUTONOMA.civilLiberties;
    }
  }

  // ── Impactos de régimen desde otros módulos (ej. justicia) ─────────────
  for (const impact of regimeImpacts) {
    const key = impact.type as keyof RegimeMetricsState;
    if (key in result && typeof result[key] === "number") {
      result[key] += impact.value;
    }
  }

  return clampMetrics(result);
}

// ─── Regeneración gradual hacia el baseline ──────────────────────────────────

/**
 * Aplica regeneración gradual: cada métrica tiende a su valor baseline
 * en REGIME_REGENERATION_RATE puntos por mes si está por debajo,
 * o decrece si está por encima.
 *
 * La regeneración solo se aplica si la métrica no fue modificada por
 * ninguna acción este turno. Se compara el estado antes y después de
 * calculateRegimeMetrics para detectar cambios.
 *
 * @param metrics - Métricas actuales (ya con modificadores aplicados)
 * @param previousMetrics - Métricas antes de aplicar modificadores este turno
 * @returns Métricas con regeneración aplicada
 */
export function regenerateRegimeMetrics(
  metrics: RegimeMetricsState,
  previousMetrics: RegimeMetricsState
): RegimeMetricsState {
  const result = { ...metrics };
  const baseline = BALANCE.REGIME_BASELINE;

  for (const key of REGIME_KEYS) {
    // Solo regenerar si no hubo cambio por acción este turno
    if (result[key] === previousMetrics[key]) {
      const base = baseline[key];
      if (result[key] < base) {
        result[key] += BALANCE.REGIME_REGENERATION_RATE;
      } else if (result[key] > base) {
        result[key] -= BALANCE.REGIME_REGENERATION_RATE;
      }
    }
  }

  return clampMetrics(result);
}

// ─── Clasificación del régimen ────────────────────────────────────────────────

/**
 * Clasifica el tipo de régimen político basado en las métricas y contexto.
 *
 * @param metrics - Métricas actuales del régimen
 * @param crimeRate - Tasa de criminalidad (0-100), opcional
 * @param corruption - Nivel de corrupción (0-100), opcional
 * @param approval - Aprobación general (0-100), opcional
 * @returns Cadena de clasificación del régimen en español
 */
export function classifyRegime(
  metrics: RegimeMetricsState,
  crimeRate?: number,
  corruption?: number,
  approval?: number
): string {
  // ── Calcular promedio simple de las 7 métricas ─────────────────────────
  const sum = REGIME_KEYS.reduce((acc, k) => acc + metrics[k], 0);
  const avg = sum / REGIME_KEYS.length;

  // ── Verificar métricas críticas para democracia plena ──────────────────
  const criticalMetrics = BALANCE.REGIME_CRITICAL_METRICS;
  const allCriticalAboveThreshold = criticalMetrics.every(
    (k) => metrics[k] > BALANCE.REGIME_FULL_DEMOCRACY
  );

  if (allCriticalAboveThreshold) {
    return "Democracia plena";
  }

  // ── Estado fallido: crimen > 80, corrupción > 80, aprobación < 15 ─────
  if (
    crimeRate !== undefined &&
    corruption !== undefined &&
    approval !== undefined &&
    crimeRate > 80 &&
    corruption > 80 &&
    approval < 15
  ) {
    return "Estado fallido";
  }

  // ── Dictadura: alta concentración de poder + promedio muy bajo ─────────
  if (metrics.powerConcentration > 85 && avg < 20) {
    return "Dictadura";
  }

  // ── Clasificación por umbrales de promedio ─────────────────────────────
  if (avg > BALANCE.REGIME_DEFECTIVE_DEMOCRACY) {
    return "Democracia defectuosa";
  }
  if (avg > BALANCE.REGIME_HYBRID) {
    return "Régimen híbrido";
  }
  if (avg > BALANCE.REGIME_AUTHORITARIAN) {
    return "Autoritarismo electoral";
  }
  if (avg <= BALANCE.REGIME_AUTHORITARIAN) {
    return "Dictadura";
  }

  return "Régimen híbrido";
}
