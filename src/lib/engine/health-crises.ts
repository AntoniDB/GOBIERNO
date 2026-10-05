// ─── Crisis sanitarias específicas (Salud-3B-ii) ──────────────────────────────
// Cinco crisis conectadas al catálogo de enfermedades, saturación hospitalaria,
// comercio exterior, corrupción y sistema de justicia.
//
// Cada función de detección recibe GameState + rng y devuelve EventState[].
// La orquestación está en turn.ts PASO 11c.

import type { GameState, EventState, RegionState } from "./types";
import type { DiseaseState } from "./diseases";
import { calculateNationalSaturationMortality } from "./indicators";
import { isMedicationShortage, calculateImportCoverage } from "./trade";
import { BALANCE } from "../balance";
import { regionBeds, regionSaturation } from "./hospital-capacity";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function healthEfficiency(state: GameState): number {
  const h = state.ministries.find((m) => m.key === "HEALTH");
  return h?.efficiency ?? 50;
}

function healthMinistryId(state: GameState): string | undefined {
  return state.ministries.find((m) => m.key === "HEALTH")?.id;
}

// ─── Crisis 1: Brote epidémico ────────────────────────────────────────────────

/**
 * Detecta brotes epidemicos especificos de enfermedades TRANSMISSIBLES
 * cuyas prevalencias superan el umbral Y la cobertura sanitaria
 * regional de la zona afectada es baja.
 *
 * Reemplaza al viejo EPIDEMIC generico de events.ts.
 */
export function detectDiseaseOutbreak(
  state: GameState,
  rng: () => number,
): EventState[] {
  const events: EventState[] = [];

  const transmissibles = (state.diseases ?? []).filter(
    (d) => d.category === "TRANSMISSIBLE",
  ) as unknown as DiseaseState[];

  if (transmissibles.length === 0) return events;

  for (const disease of transmissibles) {
    const prev = state.diseasePrevalences.find((p) => p.diseaseId === disease.id);
    if (!prev) continue;

    const currentPrev = prev.currentPrevalence;
    if (currentPrev < BALANCE.OUTBREAK_PREVALENCE_THRESHOLD) continue;

    // Buscar la region con peor cobertura (donde el brote golpea mas)
    let worstRegion: RegionState | undefined;
    let worstCoverage = 100;
    for (const region of state.regions ?? []) {
      const coverage = region.povertyRate < 30
        ? 50 + (region.infrastructureLevel / 2)
        : 30 + (region.infrastructureLevel / 4);
      if (coverage < worstCoverage) {
        worstCoverage = coverage;
        worstRegion = region;
      }
    }

    // Si no hay regiones pero la prevalencia es alta, procede igual
    if (worstRegion && worstCoverage >= BALANCE.OUTBREAK_REGIONAL_COVERAGE_THRESHOLD) continue;

    const excessPrev = currentPrev - BALANCE.OUTBREAK_PREVALENCE_THRESHOLD;
    const severity = Math.min(100, (currentPrev / 100) * 200);
    const prob = BALANCE.OUTBREAK_BASE_PROB * (1 + (excessPrev / BALANCE.OUTBREAK_PREVALENCE_THRESHOLD) * 0.5);

    if (rng() >= prob) continue;

    const duration = BALANCE.OUTBREAK_DURATION_MIN +
      Math.floor(rng() * (BALANCE.OUTBREAK_DURATION_MAX - BALANCE.OUTBREAK_DURATION_MIN + 1));

    const mortalityFactor = BALANCE.OUTBREAK_MORTALITY_MULTIPLIER_MIN +
      (severity / 100) * (BALANCE.OUTBREAK_MORTALITY_MULTIPLIER_MAX - BALANCE.OUTBREAK_MORTALITY_MULTIPLIER_MIN);

    const regionLabel = worstRegion ? ` en ${worstRegion.name}` : "";
    const description = worstRegion
      ? `Brote de ${disease.name}${regionLabel}: prevalencia del ${currentPrev.toFixed(1)}%, cobertura sanitaria ${worstCoverage.toFixed(0)}%.`
      : `Brote de ${disease.name}: prevalencia del ${currentPrev.toFixed(1)}%.`;

    events.push({
      id: `disease-outbreak-${disease.id}-${state.currentYear}-${state.currentMonth}`,
      type: "DISEASE_OUTBREAK",
      severity: Math.round(severity),
      year: state.currentYear,
      month: state.currentMonth,
      description,
      effectsApplied: {
        diseaseId: disease.id,
        mortalityMultiplier: mortalityFactor,
        durationMonths: duration,
        remainingMonths: duration,
        affectedRegionId: worstRegion?.id ?? null,
        autoProposeLaw: severity >= BALANCE.OUTBREAK_AUTO_LAW_SEVERITY_THRESHOLD,
      },
      resolvedAt: null,
    });
    break; // solo un brote por mes para no saturar
  }

  return events;
}

/**
 * Aplica efectos de brotes activos (mortalidad temporal, cada mes).
 * Llamado por PASO 11d en turn.ts.
 */
export function applyOutbreakEffects(
  state: GameState,
  eventsThisMonth: EventState[],
): void {
  // Brotes que empezaron este mes o meses anteriores y siguen activos
  const activeOutbreaks = state.events.filter(
    (e) => e.type === "DISEASE_OUTBREAK" && !e.resolvedAt,
  );

  for (const outbreak of activeOutbreaks) {
    const fx = outbreak.effectsApplied as Record<string, unknown>;
    const remaining = (fx.remainingMonths as number) ?? 0;

    if (remaining <= 0) {
      outbreak.resolvedAt = `${state.currentYear}-${state.currentMonth}`;
      continue;
    }

    // Aplicar multiplicador de mortalidad a la enfermedad este mes
    const diseaseId = fx.diseaseId as string | undefined;
    // El multiplicador se aplica en calculateDiseaseMortality via
    // shortageMultipliers; aqui solo se registra el efecto activo.

    const nextRemaining = remaining - 1;
    fx.remainingMonths = nextRemaining;
    if (nextRemaining <= 0) {
      outbreak.resolvedAt = `${state.currentYear}-${state.currentMonth}`;
    }
  }
}

// ─── Crisis 2: Colapso hospitalario ───────────────────────────────────────────

/**
 * Dispara colapso hospitalario cuando una region tiene saturacion > 150%
 * durante COLLAPSE_CONSECUTIVE_MONTHS consecutivos.
 */
export function detectHospitalCollapse(
  state: GameState,
  rng: () => number,
): EventState[] {
  const events: EventState[] = [];
  if (!state.regions || state.regions.length === 0) return events;

  const sickRate = state.sickRate;
  const saturationHistory = state.consecutiveSaturationMonths ?? {};

  for (const region of state.regions) {
    if (regionBeds(region) <= 0) continue;

    const saturationRatio = regionSaturation(state.population, sickRate, region);

    // Trackear consecutivos
    const prevMonths = saturationHistory[region.id] ?? 0;
    if (saturationRatio > BALANCE.COLLAPSE_SATURATION_THRESHOLD) {
      saturationHistory[region.id] = prevMonths + 1;
    } else {
      saturationHistory[region.id] = 0;
      continue;
    }

    if (saturationHistory[region.id] < BALANCE.COLLAPSE_CONSECUTIVE_MONTHS) continue;

    // Colapso!
    const severity = Math.min(100, Math.round((saturationRatio - 1) * 150));

    // Encontrar clase social dominante en la region (mayor poblacion)
    const classes = state.socialClasses ?? [];
    let dominantClass = classes[0];
    for (const sc of classes) {
      if (sc.populationPercent > (dominantClass?.populationPercent ?? 0)) {
        dominantClass = sc;
      }
    }

    const classLabel = dominantClass ? dominantClass.key : "general";

    saturationHistory[region.id] = 0; // resetear tras disparo

    events.push({
      id: `hospital-collapse-${region.id}-${state.currentYear}-${state.currentMonth}`,
      type: "HOSPITAL_COLLAPSE",
      severity,
      year: state.currentYear,
      month: state.currentMonth,
      description: `Colapso hospitalario en ${region.name}: saturacion del ${(saturationRatio * 100).toFixed(0)}%. La clase ${classLabel} es la mas afectada.`,
      effectsApplied: {
        regionId: region.id,
        saturationRatio,
        mortalityFactor: 1 + BALANCE.COLLAPSE_MORTALITY_FACTOR * severity,
        dominantClassKey: dominantClass?.key,
        approvalPenalty: Math.round(-5 - (severity / 100) * 10),
      },
      resolvedAt: null,
    });

    break; // solo un colapso por mes
  }

  // Persistir el historial de saturacion
  state.consecutiveSaturationMonths = saturationHistory;

  return events;
}

// ─── Crisis 3: Escasez de medicamentos ────────────────────────────────────────

/**
 * Genera notificacion cuando la cobertura de importacion cae bajo el umbral.
 * La mortalidad ya se aplica via calculateDiseaseMortality (Parte II).
 * Solo notifica la transicion: sin escasez → con escasez.
 */
export function detectMedicationShortage(
  state: GameState,
  wasShortage: boolean,
): EventState[] {
  const isShortage = isMedicationShortage(state);
  if (!isShortage || wasShortage) return [];

  const coverage = calculateImportCoverage(state);
  const severity = Math.min(100, Math.round((1 - coverage) * 200));

  return [{
    id: `med-shortage-${state.currentYear}-${state.currentMonth}`,
    type: "MEDICATION_SHORTAGE",
    severity,
    year: state.currentYear,
    month: state.currentMonth,
    description: `Escasez de medicamentos: la cobertura de importacion ha caido al ${(coverage * 100).toFixed(0)}% (umbral: ${Math.round(BALANCE.TRADE_SHORTAGE_COVERAGE_THRESHOLD * 100)}%). La mortalidad por enfermedades cronicas, transmisibles y de salud mental aumenta.`,
    effectsApplied: { coverage, shortageMultiplier: 1 + severity / 100 },
    resolvedAt: null,
  }];
}

// ─── Crisis 4: Escándalo de mala praxis ───────────────────────────────────────

/**
 * Escandalo aleatorio de mala praxis. Probabilidad escala con
 * internalCorruption del Ministerio de Salud.
 * Si se dispara, busca un director de hospitales y abre investigacion
 * judicial automatica contra el.
 */
export function detectMalpracticeScandal(
  state: GameState,
  rng: () => number,
): EventState[] {
  const healthMinistry = state.ministries.find((m) => m.key === "HEALTH");
  const corruption = healthMinistry?.internalCorruption ?? 0;

  const corruptionFactor = Math.max(0, (corruption - BALANCE.MALPRACTICE_CORRUPTION_THRESHOLD) / 100);
  const prob = BALANCE.MALPRACTICE_BASE_PROB * (1 + corruptionFactor * 3);

  if (rng() >= prob) return [];

  // Buscar directores del Ministerio de Salud
  const hId = healthMinistryId(state);
  const directors = state.officials.filter(
    (o) => o.role === "MINISTRY_DIRECTOR" && o.ministryId === hId && o.status === "ACTIVE",
  );

  if (directors.length === 0) return [];

  // Elegir el director con mayor skill (mas visible) o aleatorio
  const target = directors.reduce((best, d) =>
    (d.skill ?? 50) > (best.skill ?? 50) ? d : best,
    directors[0]);

  const severity = Math.min(100, Math.round(corruption * 1.2));
  const reputationHit = Math.round(severity / 2);

  return [{
    id: `malpractice-${target.id}-${state.currentYear}-${state.currentMonth}`,
    type: "MALPRACTICE_SCANDAL",
    severity,
    year: state.currentYear,
    month: state.currentMonth,
    description: `Escandalo de mala praxis: el director ${target.name} del Ministerio de Salud ha sido vinculado a negligencias hospitalarias. Corrupcion interna del ministerio: ${corruption.toFixed(0)}%.`,
    effectsApplied: {
      directorOfficialId: target.id,
      reputationHit,
      approvalPenalty: -Math.round(severity / 5),
      opensJudicialCase: true,
    },
    resolvedAt: null,
  }];
}

// ─── Crisis 5: Avance médico ──────────────────────────────────────────────────

/**
 * Evento positivo: avance medico aleatorio.
 * Mayor probabilidad si:
 *   A. Se completo un LRD MEDICAL_RESEARCH este mes → 30%
 *   B. HEALTH.efficiency >= 70 por 3+ meses consecutivos → 15%/mes
 * Toma la probabilidad maxima entre A y B.
 * Reduce mortalityRate de 1 enfermedad aleatoria en 20%.
 * Cada enfermedad solo puede beneficiarse 1 vez.
 */
export function detectMedicalBreakthrough(
  state: GameState,
  rng: () => number,
  researchCompletedThisMonth: boolean,
  alreadyBenefitedDiseaseIds: string[],
): EventState[] {
  if (!state.diseases || state.diseases.length === 0) return [];

  const eff = healthEfficiency(state);
  const streak = state.healthEfficiencyStreak ?? 0;

  let prob = 0;
  if (researchCompletedThisMonth) {
    prob = Math.max(prob, BALANCE.BREAKTHROUGH_RESEARCH_PROB);
  }
  if (eff >= BALANCE.BREAKTHROUGH_EFFICIENCY_THRESHOLD && streak >= BALANCE.BREAKTHROUGH_EFFICIENCY_STREAK) {
    prob = Math.max(prob, BALANCE.BREAKTHROUGH_EFFICIENCY_PROB);
  }

  if (prob <= 0 || rng() >= prob) return [];

  // Elegir una enfermedad que no haya recibido breakthrough aun
  const eligible = (state.diseases as unknown as DiseaseState[]).filter(
    (d) => !alreadyBenefitedDiseaseIds.includes(d.id),
  );

  if (eligible.length === 0) return [];

  const disease = eligible[Math.floor(rng() * eligible.length)];

  // Aplicar reduccion de mortalidad (20% del valor actual, con piso 5%)
  const originalMortality = disease.mortalityRate;
  const newMortality = Math.max(
    originalMortality * BALANCE.BREAKTHROUGH_MORTALITY_FLOOR_RATIO,
    originalMortality * BALANCE.BREAKTHROUGH_MORTALITY_REDUCTION,
  );
  disease.mortalityRate = newMortality;
  const reductionPct = Math.round((1 - newMortality / originalMortality) * 100);

  const severity = 30 + Math.floor(rng() * 21); // 30-50

  return [{
    id: `medical-breakthrough-${disease.id}-${state.currentYear}-${state.currentMonth}`,
    type: "MEDICAL_BREAKTHROUGH",
    severity,
    year: state.currentYear,
    month: state.currentMonth,
    description: `Avance medico: nuevos tratamientos para ${disease.name} reducen su mortalidad en un ${reductionPct}%. La comunidad cientifica celebra el hallazgo.`,
    effectsApplied: {
      diseaseId: disease.id,
      diseaseName: disease.name,
      mortalityBefore: originalMortality,
      mortalityAfter: newMortality,
      reductionPct,
      alreadyBenefited: true,
    },
    resolvedAt: null,
  }];
}

// ─── Tracking de streaks ──────────────────────────────────────────────────────

/**
 * Actualiza el contador de meses consecutivos con alta eficiencia en Salud.
 * Llamado en cada PASO del motor.
 */
export function updateEfficiencyStreak(state: GameState): void {
  const eff = healthEfficiency(state);
  if (eff >= BALANCE.BREAKTHROUGH_EFFICIENCY_THRESHOLD) {
    state.healthEfficiencyStreak = (state.healthEfficiencyStreak ?? 0) + 1;
  } else {
    state.healthEfficiencyStreak = 0;
  }
}
