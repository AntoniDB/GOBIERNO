// ─── Evaluacion de condiciones de fin de partida ──────────────────────────
// Lee valores YA calculados por el motor (aprobacion, regimen, corrupcion)
// sin duplicar ningun calculo. Funcion pura y testeable.
//
// Condiciones (SPEC seccion 9):
//  - Golpe de estado: subordinacion militar <30, aprobacion <25, corrupcion >50
//  - Juicio politico: viene de evaluateMotions() en congress.ts (motion.type === "juicio_politico")
//  - Renuncia forzada: aprobacion <10 durante 6 meses consecutivos
//  - Perdida electoral: elecciones cada 5 anios, pierdes si aprobacion <40
//  - Fin de mandato: limite de mandatos (default 2 = 10 anios)
//  - Asesinato: aprobacion <15, inteligencia con autonomia <30 y existe
//  - Estado fallido: crimen >80, corrupcion >80, aprobacion <15

import type { GameState, GameOverResult, GameOverConfig, RegimeMetricsState } from "./types";
import { calculateGeneralApproval } from "./approval";
import { calculateGlobalCorruption } from "./corruption";
import { BALANCE } from "../balance";

const DEFAULT_CONFIG: GameOverConfig = {
  electionIntervalYears: 5,
  termLimit: 2,
  consecutiveLowApprovalMonths: 6,
};

/**
 * Evalua todas las condiciones de fin de partida.
 * Retorna el primer GameOverResult que se cumpla, o null si el juego continua.
 *
 * @param state - Estado completo YA procesado del turno
 * @param config - Configuracion de fin de partida
 * @param motionNotifications - Notificaciones de mociones generadas este turno
 * @returns Resultado de game over o null
 */
export function checkGameOverConditions(
  state: GameState,
  config: GameOverConfig = DEFAULT_CONFIG,
  motionNotifications?: { type: string; title: string }[]
): GameOverResult | null {
  const approval = calculateGeneralApproval(state, state.events);
  const corruption = calculateGlobalCorruption(state.officials);
  const crimeRate = state.crimeRate;
  const { regimeMetrics } = state;

  // ── Buscar mocion de juicio politico ──────────────────────────────────
  const hasImpeachment = motionNotifications?.some(
    (n) => n.type === "juicio_politico"
  );

  // ── Inteligencia (para asesinato y golpe) ─────────────────────────────
  const intelligenceOrg = state.organisms.find(
    (o) => o.type === "INTELLIGENCE"
  );
  const defenseMinistry = state.ministries.find(
    (m) => m.key === "DEFENSE"
  );

  // ── 1. Estado fallido ─────────────────────────────────────────────────
  // Crimen >80, corrupcion >80, aprobacion <15 simultaneamente
  if (crimeRate > 80 && corruption > 80 && approval < 15) {
    return {
      reason: "estado_fallido",
      description:
        "El pais ha colapsado en un estado fallido. El crimen y la corrupcion desbordaron toda institucion, y la poblacion retiro completamente su apoyo al gobierno. Regiones se autonomizan y surgen grupos armados.",
      regimeType: "Estado fallido",
      approval,
      corruption,
      treasury: state.treasury,
      gdp: state.gdp ?? 0,
    };
  }

  // ── 2. Juicio politico (viene del congreso) ───────────────────────────
  if (hasImpeachment) {
    return {
      reason: "juicio_politico",
      description:
        "El Congreso ha aprobado un juicio politico contra el mandatario. Ha sido destituido del cargo por decision legislativa.",
      regimeType: state.regimeMetrics
        ? classifyFromMetrics(state.regimeMetrics, crimeRate, corruption, approval)
        : "Desconocido",
      approval,
      corruption,
      treasury: state.treasury,
      gdp: state.gdp ?? 0,
    };
  }

  // ── 3. Golpe de estado ────────────────────────────────────────────────
  // subordinacion militar <30, aprobacion <25, corrupcion >50
  // Exito depende de defensa + inteligencia (si existe)
  if (
    regimeMetrics.militarySubordination < 30 &&
    approval < 25 &&
    corruption > 50
  ) {
    const defenseEfficiency = defenseMinistry?.efficiency ?? 50;
    const intelligenceEffectiveness = intelligenceOrg?.effectiveness ?? 0;

    // Probabilidad de exito del golpe:
    // Base 70% - defensa/2 + si no hay inteligencia: +20%
    const coupSuccessChance =
      70 - defenseEfficiency / 2 + (intelligenceOrg ? 0 : 20);

    if (coupSuccessChance > 50) {
      return {
        reason: "golpe_estado",
        description:
          "Las fuerzas armadas han ejecutado un golpe de estado exitoso. La baja subordinacion militar, la perdida de apoyo popular y la corrupcion generalizada crearon las condiciones para la ruptura del orden constitucional.",
        regimeType: "Dictadura",
        approval,
        corruption,
        treasury: state.treasury,
        gdp: state.gdp ?? 0,
      };
    }
  }

  // ── 4. Asesinato ──────────────────────────────────────────────────────
  // aprobacion <15, inteligencia con autonomia <30
  if (approval < 15 && intelligenceOrg && intelligenceOrg.autonomyLevel < 30) {
    // Probabilidad mensual baja: ~3%
    const assassinationChance = 3;
    // Nota: la aleatoriedad la maneja el llamador (que pasa rng),
    // aqui solo evaluamos si la condicion es POSIBLE. El chequeo
    // probabilistico se hace en processTurn.
    // Devolvemos el resultado si se cumple; el rng lo decide el motor.
  }

  // ── 5. Renuncia forzada ───────────────────────────────────────────────
  // aprobacion <10 durante 6 meses consecutivos
  // (El contador de meses se maneja externamente via config)
  if (approval < 10 && config.consecutiveLowApprovalMonths >= 6) {
    return {
      reason: "renuncia_forzada",
      description:
        "Tras 6 meses consecutivos con una aprobacion por debajo del 10%, la presion social y politica ha forzado la renuncia del mandatario. El gobierno ha perdido toda legitimidad.",
      regimeType: classifyFromMetrics(
        state.regimeMetrics,
        crimeRate,
        corruption,
        approval
      ),
      approval,
      corruption,
      treasury: state.treasury,
      gdp: state.gdp ?? 0,
    };
  }

  // ── 6. Perdida electoral ──────────────────────────────────────────────
  // Elecciones cada config.electionIntervalYears anios
  // Pierdes si aprobacion < 40
  const totalMonths = (state.currentYear - 1) * 12 + state.currentMonth;
  const electionIntervalMonths = config.electionIntervalYears * 12;
  if (
    totalMonths > 0 &&
    totalMonths % electionIntervalMonths === 0 &&
    state.currentMonth === 0
  ) {
    if (approval < 40) {
      return {
        reason: "perdida_electoral",
        description:
          "Han transcurrido las elecciones presidenciales y el mandatario ha perdido en las urnas. La baja aprobacion popular se tradujo en una derrota electoral contundente.",
        regimeType: classifyFromMetrics(
          state.regimeMetrics,
          crimeRate,
          corruption,
          approval
        ),
        approval,
        corruption,
        treasury: state.treasury,
        gdp: state.gdp ?? 0,
      };
    }
  }

  // ── 7. Fin de mandato ─────────────────────────────────────────────────
  // Limite constitucional de mandatos
  const maxMonths = config.termLimit * config.electionIntervalYears * 12;
  if (totalMonths >= maxMonths) {
    return {
      reason: "fin_mandato",
      description:
        "El mandatario ha alcanzado el limite constitucional de mandatos. Es hora de pasar el poder a un sucesor electo democraticamente.",
      regimeType: classifyFromMetrics(
        state.regimeMetrics,
        crimeRate,
        corruption,
        approval
      ),
      approval,
      corruption,
      treasury: state.treasury,
      gdp: state.gdp ?? 0,
    };
  }

  return null;
}

/**
 * Evalua si las condiciones para asesinato son posibles (sin aleatoriedad).
 * La probabilidad se chequea en processTurn con el rng.
 */
export function canBeAssassinated(
  state: GameState,
  rng: () => number
): GameOverResult | null {
  const approval = calculateGeneralApproval(state, state.events);
  const corruption = calculateGlobalCorruption(state.officials);
  const intelligenceOrg = state.organisms.find(
    (o) => o.type === "INTELLIGENCE"
  );

  if (
    approval < 15 &&
    intelligenceOrg &&
    intelligenceOrg.autonomyLevel < 30 &&
    rng() < 0.03
  ) {
    return {
      reason: "asesinato",
      description:
        "El mandatario ha sido asesinado en un atentado politico. La combinacion de bajisima aprobacion popular y un servicio de inteligencia usado con fines politicos creo las condiciones para este tragico desenlace.",
      regimeType: "Crisis",
      approval,
      corruption,
      treasury: state.treasury,
      gdp: state.gdp ?? 0,
    };
  }

  return null;
}

function classifyFromMetrics(
  metrics: RegimeMetricsState,
  _crime: number,
  _corruption: number,
  _approval: number
): string {
  const avg =
    ((metrics.powerConcentration ?? 50) +
      (metrics.pressFreedom ?? 50) +
      (metrics.judicialIndependence ?? 50) +
      (metrics.politicalPluralism ?? 50) +
      (metrics.civilLiberties ?? 50) +
      (metrics.transparency ?? 50) +
      (metrics.militarySubordination ?? 50)) /
    7;
  if (avg > 70) return "Democracia plena";
  if (avg > 55) return "Democracia defectuosa";
  if (avg > 35) return "Regimen hibrido";
  if (avg > 20) return "Autoritarismo electoral";
  return "Dictadura";
}
