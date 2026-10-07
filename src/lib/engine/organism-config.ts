// ─── Configuración de un organismo nuevo ─────────────────────────────────────
// El jugador elige presupuesto, personal y autonomía al crear un organismo. El cliente no es de
// fiar: el motor valida cada valor y lo acota a su rango. Antes el formulario enviaba solo nombre,
// presupuesto y titular, y el motor fijaba personal 10 y autonomía 50 (los sliders no hacían nada).
//
//   presupuesto: se acota al rango del país (`clampOrganismBudget`); no finito → mínimo
//   personal:    entero entre ORGANISM_STAFF_MIN y ORGANISM_STAFF_MAX
//   autonomía:   entre 0 y 100
// Sin valor se usa el de BALANCE; un valor que no es un número finito se descarta (se usa el
// de BALANCE) y se avisa, igual que las demás entradas inválidas del cliente (ver #6 y #9).

import { BALANCE } from "../balance";
import { clampOrganismBudget } from "./cost-scale";

export interface NewOrganismRequest {
  name: string;
  monthlyBudget: number;
  headOfficialId?: string;
  /** Personal (5-50). Opcional: por defecto ORGANISM_STAFF_DEFAULT. */
  staff?: number;
  /** Autonomía (0-100). Opcional: por defecto ORGANISM_AUTONOMY_DEFAULT. */
  autonomyLevel?: number;
}

export interface ResolvedOrganismConfig {
  monthlyBudget: number;
  staff: number;
  autonomyLevel: number;
  /** El presupuesto efectivo difiere del pedido (se acotó al rango del país) */
  budgetAdjusted: boolean;
  /** Valores descartados por no ser numéricos, para avisar al jugador */
  warnings: string[];
}

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function resolveOrganismConfig(request: NewOrganismRequest, population: number): ResolvedOrganismConfig {
  const warnings: string[] = [];

  const monthlyBudget = clampOrganismBudget(request.monthlyBudget, population);

  let staff: number = BALANCE.ORGANISM_STAFF_DEFAULT;
  if (request.staff !== undefined && request.staff !== null) {
    if (isFiniteNumber(request.staff)) {
      staff = Math.min(BALANCE.ORGANISM_STAFF_MAX, Math.max(BALANCE.ORGANISM_STAFF_MIN, Math.round(request.staff)));
    } else {
      warnings.push(`el personal debe ser un número (se usó ${BALANCE.ORGANISM_STAFF_DEFAULT})`);
    }
  }

  let autonomyLevel: number = BALANCE.ORGANISM_AUTONOMY_DEFAULT;
  if (request.autonomyLevel !== undefined && request.autonomyLevel !== null) {
    if (isFiniteNumber(request.autonomyLevel)) {
      autonomyLevel = Math.min(100, Math.max(0, request.autonomyLevel));
    } else {
      warnings.push(`la autonomía debe ser un número (se usó ${BALANCE.ORGANISM_AUTONOMY_DEFAULT})`);
    }
  }

  return {
    monthlyBudget,
    staff,
    autonomyLevel,
    budgetAdjusted: isFiniteNumber(request.monthlyBudget) ? monthlyBudget !== request.monthlyBudget : true,
    warnings,
  };
}
