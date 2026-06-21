// ─── Métricas de régimen y clasificación ─────────────────────────────────────
// Calcula las métricas del régimen político y clasifica el tipo de régimen.
// Funciones puras y deterministas.

import type { RegimeMetricsState } from "./types";
import { BALANCE } from "../balance";

/**
 * Aplica los modificadores de acciones del jugador a las métricas de régimen.
 *
 * @param metrics - Métricas actuales del régimen
 * @param actions - Acciones realizadas este turno que afectan el régimen
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
  }
): RegimeMetricsState {
  const result = { ...metrics };

  // ── Censura de medios: reduce libertad de prensa, concentra poder ──────
  if (actions.censorMedia) {
    result.pressFreedom += BALANCE.REGIME_CENSOR_PRESS_PENALTY;
    result.powerConcentration += BALANCE.REGIME_CENSOR_POWER_BONUS;
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

  // ── Efectos de leyes activas (si se aplicaron leyes de régimen) ────────
  // Estos efectos se aplican en el paso de leyes del turno; aquí los
  // incluimos como referencia para que el motor pueda recalcular.

  // ── Clamp de todas las métricas a [0, 100] ─────────────────────────────
  const keys: (keyof RegimeMetricsState)[] = [
    "powerConcentration",
    "pressFreedom",
    "judicialIndependence",
    "politicalPluralism",
    "civilLiberties",
    "transparency",
    "militarySubordination",
  ];

  for (const key of keys) {
    result[key] = Math.max(0, Math.min(100, Math.round(result[key] * 10) / 10));
  }

  return result;
}

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
  const keys: (keyof RegimeMetricsState)[] = [
    "powerConcentration",
    "pressFreedom",
    "judicialIndependence",
    "politicalPluralism",
    "civilLiberties",
    "transparency",
    "militarySubordination",
  ];

  const sum = keys.reduce((acc, k) => acc + metrics[k], 0);
  const avg = sum / keys.length;

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

  // ── Default ────────────────────────────────────────────────────────────
  return "Régimen híbrido";
}
