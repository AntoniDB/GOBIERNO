// ─── Programas operativos del Ministerio de Salud (Salud-3A Capa D) ───────────
// Programas persistentes lanzables por el Ministro (sin aprobacion del Senado).
// Tipos:
//   1. VACCINATION_CAMPAIGN — elegir enfermedad con hasVaccine=true, baja su
//      prevalencia hacia un minimo proporcional a prevalenceBase mientras activa.
//      Al desactivar, la prevalencia sube lentamente hacia prevalenceBase.
//   2. PREVENTION_EDUCATION — abate transmisibles + cronicos de forma transversal.
//   3. MENTAL_HEALTH_PROGRAM — abate depresion, ansiedad, adicciones; ademas da
//      bonus de aprobacion a POVERTY y MIDDLE mientras activo.
//
// Costo mensual fijo descontado del tesoro automaticamente, igual que las LRD.
// Los efectos se aplican sobre state.diseasePrevalences cada mes.
//
// Tipos 4 (construccion de hospital) y 5 (investigacion) usan el sistema LRD
// generico de long-running-decisions.ts, no este modulo. La configuracion de
// los costos/duraciones vive en balance.ts.

import type {
  GameState,
  TurnInput,
  MinistryProgramState,
  DiseaseStateInput,
  TurnNotification,
} from "./types";
import { BALANCE } from "../balance";

/**
 * Catalogo de enfermedades que tienen vacuna disponible.
 * El jugador solo puede elegir una de estas para VACCINATION_CAMPAIGN.
 */
export function getVaccineDiseases(state: GameState): DiseaseStateInput[] {
  return (state.diseases ?? []).filter((d) => d.hasVaccine);
}

/**
 * Catalogo de enfermedades de salud mental (Depresion, Ansiedad, Adicciones).
 */
export function getMentalHealthDiseases(state: GameState): DiseaseStateInput[] {
  return (state.diseases ?? []).filter((d) => d.category === "MENTAL_HEALTH");
}

/** Crea un programa desde el input del jugador. */
export function createProgram(
  state: GameState,
  type: MinistryProgramState["type"],
  parameters: Record<string, unknown> = {},
  monthlyCost?: number,
  idx = 0,
): MinistryProgramState {
  const id = `prog-${state.currentYear}-${state.currentMonth}-${idx}`;
  const cost = monthlyCost ?? defaultCostFor(type);
  return {
    id,
    type,
    parameters,
    monthlyCost: cost,
    status: "ACTIVE",
    startedAt: new Date().toISOString(),
    deactivatedAt: null,
  };
}

/** Costo por defecto segun el tipo de programa. */
export function defaultCostFor(type: MinistryProgramState["type"]): number {
  switch (type) {
    case "VACCINATION_CAMPAIGN":
      return BALANCE.PROGRAM_VACCINATION_COST;
    case "PREVENTION_EDUCATION":
      return BALANCE.PROGRAM_PREVENTION_COST;
    case "MENTAL_HEALTH_PROGRAM":
      return BALANCE.PROGRAM_MENTAL_HEALTH_COST;
  }
}

/**
 * Crea nuevos programas desde el input del jugador de este mes.
 */
export function createNewPrograms(
  state: GameState,
  input: TurnInput,
): MinistryProgramState[] {
  const out: MinistryProgramState[] = [];
  if (!input.newPrograms) return out;
  let idx = 0;
  for (const cfg of input.newPrograms) {
    out.push(
      createProgram(
        state,
        cfg.type,
        cfg.parameters ?? {},
        cfg.monthlyCost,
        idx,
      ),
    );
    idx++;
  }
  return out;
}

/**
 * Avanza todos los programas activos un mes:
 *  - Descuenta monthlyCost del tesoro (devuelto por el orquestador)
 *  - Aplica efectos sobre diseasePrevalences
 *  - Marca CANCELLED los indicados por el jugador
 *
 * Devuelve:
 *  - updatedPrograms: lista con status actualizado
 *  - totalCost: suma de monthlyCost de los que siguen activos este mes
 *  - cancelled: programas desactivados este mes
 */
export function advancePrograms(
  state: GameState,
  input: TurnInput,
): {
  updatedPrograms: MinistryProgramState[];
  totalCost: number;
  cancelled: MinistryProgramState[];
} {
  const updated: MinistryProgramState[] = [];
  let totalCost = 0;
  const cancelled: MinistryProgramState[] = [];
  const cancelSet = new Set(input.cancelProgramIds ?? []);

  for (const prog of state.programs ?? []) {
    if (prog.status !== "ACTIVE") {
      updated.push({ ...prog });
      continue;
    }
    const p = { ...prog };

    if (cancelSet.has(prog.id)) {
      p.status = "CANCELLED";
      p.deactivatedAt = new Date().toISOString();
      cancelled.push(p);
      // No se descuenta el costo del mes en que se cancela (igual que las LRD)
    } else {
      // sigue activo: descuenta costo
      totalCost += prog.monthlyCost;
    }
    updated.push(p);
  }

  // Aplicar efectos sobre prevalencias (solo sobre los que siguen activos)
  applyProgramEffects(state, updated.filter((p) => p.status === "ACTIVE"));

  // Bonus de aprobacion del programa de salud mental
  applyMentalHealthApprovalBonus(state, updated);

  return { updatedPrograms: updated, totalCost, cancelled };
}

/**
 * Aplica el efecto de reduccion de prevalencia sobre state.diseasePrevalences.
 * Para cada programa activo, modifica la prevalencia de las enfermedades que toque.
 */
export function applyProgramEffects(
  state: GameState,
  activePrograms: MinistryProgramState[],
): void {
  if (!state.diseases || state.diseases.length === 0) return;
  if (!state.diseasePrevalences) state.diseasePrevalences = [];

  // Indice de enfermedades por id para lookup
  const diseasesById = new Map(state.diseases.map((d) => [d.id, d]));

  // InicializarTarget prevalences si vienen vacias
  for (const d of state.diseases) {
    if (state.diseasePrevalences.find((p) => p.diseaseId === d.id)) continue;
    state.diseasePrevalences.push({
      id: `prev-${d.id}`,
      diseaseId: d.id,
      currentPrevalence: d.prevalenceBase,
    });
  }

  // Procesar cada programa activo en orden
  for (const prog of activePrograms) {
    switch (prog.type) {
      case "VACCINATION_CAMPAIGN":
        applyVaccinationCampaign(state, prog, diseasesById);
        break;
      case "PREVENTION_EDUCATION":
        applyPreventionEducation(state, prog, diseasesById);
        break;
      case "MENTAL_HEALTH_PROGRAM":
        applyMentalHealthProgram(state, prog, diseasesById);
        break;
    }
  }

  // Programas inactivos: revertir prevalencias hacia prevalenceBase
  applyUnprogrammedRecovery(state, activePrograms, diseasesById);
}

/**
 * Campaña de vacunacion: baja la prevalencia de la enfermedad elegida hacia
 * MIN_RATIO × prevalenceBase. La prevalencia solo baja si esta activa.
 */
function applyVaccinationCampaign(
  state: GameState,
  prog: MinistryProgramState,
  diseasesById: Map<string, DiseaseStateInput>,
): void {
  const diseaseId = prog.parameters.diseaseId as string;
  if (!diseaseId) return;
  const disease = diseasesById.get(diseaseId);
  if (!disease || !disease.hasVaccine) return;

  const prev = state.diseasePrevalences.find((p) => p.diseaseId === diseaseId);
  if (prev) prev.currentPrevalence = decayToward(
    prev.currentPrevalence,
    disease.prevalenceBase * BALANCE.VACCINATION_MIN_RATIO,
    BALANCE.VACCINATION_PREVALENCE_DECAY,
  );
}

/**
 * Programa de prevencion: baja transmissionables + cronicos hacia
 * PREVENTION_MIN_RATIO × prevalenceBase. Efecto sutil pero acumulativo.
 */
function applyPreventionEducation(
  state: GameState,
  _prog: MinistryProgramState,
  diseasesById: Map<string, DiseaseStateInput>,
): void {
  for (const prev of state.diseasePrevalences) {
    const disease = diseasesById.get(prev.diseaseId);
    if (!disease) continue;
    if (disease.category !== "TRANSMISSIBLE" && disease.category !== "CHRONIC") continue;
    prev.currentPrevalence = decayToward(
      prev.currentPrevalence,
      disease.prevalenceBase * BALANCE.PREVENTION_MIN_RATIO,
      BALANCE.PREVENTION_PREVALENCE_DECAY,
    );
  }
}

/**
 * Programa de salud mental: baja mentales hacia MENTAL_HEALTH_MIN_RATIO × base.
 * Afecta solo MENTAL_HEALTH — no toca transmisibles/cronicos.
 */
function applyMentalHealthProgram(
  state: GameState,
  _prog: MinistryProgramState,
  diseasesById: Map<string, DiseaseStateInput>,
): void {
  for (const prev of state.diseasePrevalences) {
    const disease = diseasesById.get(prev.diseaseId);
    if (!disease || disease.category !== "MENTAL_HEALTH") continue;
    prev.currentPrevalence = decayToward(
      prev.currentPrevalence,
      disease.prevalenceBase * BALANCE.MENTAL_HEALTH_MIN_RATIO,
      BALANCE.MENTAL_HEALTH_PREVALENCE_DECAY,
    );
  }
}

/**
 * Recuperacion: para enfermedades que NO tienen programa activo sobre ellas,
 * subir la prevalencia hacia prevalenceBase a su tasa de recuperacion.
 *
 * La tasa de recuperacion depende del tipo de programa que normally las cubriria:
 *  - transmisibles con vacuna: VACCINATION_RECOVERY_RATE
 *  - transmisibles/cronicos sin relacion: PREVENTION_RECOVERY_RATE
 *  - mentales: MENTAL_HEALTH_RECOVERY_RATE
 */
function applyUnprogrammedRecovery(
  state: GameState,
  activePrograms: MinistryProgramState[],
  diseasesById: Map<string, DiseaseStateInput>,
): void {
  // Set de diseaseIds cubiertos por una campaña de vacunacion activa
  const vaccinatedIds = new Set<string>(
    activePrograms
      .filter((p) => p.type === "VACCINATION_CAMPAIGN" && p.parameters.diseaseId)
      .map((p) => p.parameters.diseaseId as string),
  );
  const preventionActive = activePrograms.some((p) => p.type === "PREVENTION_EDUCATION");
  const mentalActive = activePrograms.some((p) => p.type === "MENTAL_HEALTH_PROGRAM");

  for (const prev of state.diseasePrevalences) {
    const disease = diseasesById.get(prev.diseaseId);
    if (!disease) continue;

    let rate: number;
    let covered: boolean;
    if (disease.category === "MENTAL_HEALTH") {
      // Mentales: solo cubiertas por el programa de salud mental.
      rate = BALANCE.MENTAL_HEALTH_RECOVERY_RATE;
      covered = mentalActive;
    } else if (disease.category === "TRANSMISSIBLE" && disease.hasVaccine) {
      // Transmisibles con vacuna disponible: cubiertas si hay campaña específica
      // sobre esta enf. o si el programa de prevencion esta activo (abate todas).
      rate = BALANCE.VACCINATION_RECOVERY_RATE;
      covered = vaccinatedIds.has(prev.diseaseId) || preventionActive;
    } else {
      // Resto (transmisibles sin vacuna + cronicos): cubiertas por prevencion.
      rate = BALANCE.PREVENTION_RECOVERY_RATE;
      covered = preventionActive;
    }

    // Si la enfermedad está cubierta por un programa activo, no recuperar
    // (el efecto del programa ya actuó en applyProgramEffects)
    if (covered) continue;

    // Recuperar hacia prevalenceBase
    prev.currentPrevalence = recoverToward(
      prev.currentPrevalence,
      disease.prevalenceBase,
      rate,
    );
  }
}

/**
 * Mueve value hacia target bajando por `delta` (no pasa del target).
 * Para programas activos que reducen prevalencia.
 */
function decayToward(value: number, target: number, delta: number): number {
  if (value <= target) return value; // ya esta en el minimo
  const newVal = value - delta;
  return Math.max(target, Math.round(newVal * 100) / 100);
}

/**
 * Mueve value hacia target subiendo por `delta` (no pasa del target).
 * Para programas desactivados que dejan la prevalencia recuperarse.
 */
function recoverToward(value: number, target: number, delta: number): number {
  if (value >= target) return value; // ya esta en la base
  const newVal = value + delta;
  return Math.min(target, Math.round(newVal * 100) / 100);
}

/**
 * Aplica bonus de aprobacion mensual del programa de salud mental.
 * Mientras haya al menos un MENTAL_HEALTH_PROGRAM activo, POVERTY y MIDDLE
 * reciben el bonus correspondiente. Clamp a [0, 100].
 */
export function applyMentalHealthApprovalBonus(
  state: GameState,
  updatedPrograms: MinistryProgramState[],
): void {
  const mentalActive = updatedPrograms.some(
    (p) => p.type === "MENTAL_HEALTH_PROGRAM" && p.status === "ACTIVE",
  );
  if (!mentalActive) return;

  const bonusMap = BALANCE.MENTAL_HEALTH_APPROVAL_BONUS;
  for (const sc of state.socialClasses) {
    const bonus = bonusMap[sc.key as keyof typeof bonusMap] ?? 0;
    if (bonus === 0) continue;
    sc.approval = Math.max(0, Math.min(100, Math.round((sc.approval + bonus) * 100) / 100));
  }
}

/**
 * Genera notificaciones para programas completados/cancelados este mes.
 */
export function programNotifications(
  cancelled: MinistryProgramState[],
): TurnNotification[] {
  return cancelled.map((p) => ({
    type: "warning" as const,
    title: "Programa desactivado",
    description: `El programa "${programLabel(p)}" ha sido desactivado.`,
  }));
}

/** Label legible para mostrar en UI. */
export function programLabel(prog: MinistryProgramState): string {
  switch (prog.type) {
    case "VACCINATION_CAMPAIGN":
      return `Campaña de vacunación — ${prog.parameters.diseaseName ?? prog.parameters.diseaseId ?? "enfermedad"}`;
    case "PREVENTION_EDUCATION":
      return "Programa de prevención sanitaria";
    case "MENTAL_HEALTH_PROGRAM":
      return "Programa de salud mental";
  }
}