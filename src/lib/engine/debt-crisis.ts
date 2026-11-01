// ─── Crisis de deuda: austeridad o default (Economía, Fase 3) ────────────────
// Máquina de estados pura sobre GameState (muta el estado que recibe, como el resto del turno):
//   sin crisis ──(intereses/recaudación ≥ umbral o deuda/PIB ≥ umbral)──▶ crisis abierta (debtCrisisMonths ≥ 1)
//   crisis abierta ──(el jugador elige AUSTERITY)──▶ recorte de presupuestos, golpe de aprobación, bono de puntaje
//   crisis abierta ──(el jugador elige DEFAULT, o pasan DEBT_CRISIS_GRACE_MONTHS turnos sin responder)──▶ default:
//        quita de la deuda, puntaje al piso, mercados cerrados (el déficit se monetiza: inflación), sanciones
// Tras resolver una crisis hay un enfriamiento (DEBT_CRISIS_COOLDOWN_MONTHS) antes de poder abrir otra.

import { BALANCE } from "../balance";
import { currentApproval } from "./approval";
import { calculateGlobalCorruption } from "./corruption";
import { debtToGdp, monthlyDebtInterest, settlePublicDebt } from "./fiscal";
import { monetaryCredibility } from "./monetary";
import { creditScoreTarget, interestBurden, nextCreditScore, ratingFromScore } from "./rating";
import type { GameState, TurnNotification } from "./types";

export type DebtCrisisResponse = "AUSTERITY" | "DEFAULT";

const mM = (n: number) => `M$ ${(n / 1_000_000).toFixed(1)}`;

/** ¿Hay una crisis de deuda abierta esperando respuesta? */
export function isDebtCrisisOpen(state: Pick<GameState, "debtCrisisMonths">): boolean {
  return (state.debtCrisisMonths ?? 0) > 0;
}

/** ¿Los mercados están cerrados (default reciente)? */
export function areMarketsClosed(state: Pick<GameState, "marketsClosedMonths">): boolean {
  return (state.marketsClosedMonths ?? 0) > 0;
}

/** Resta `base × peso de la clase` puntos a la aprobación guardada de cada clase (se disipa con la inercia). */
function hitApproval(state: Pick<GameState, "socialClasses">, base: number): void {
  const weights = BALANCE.CRISIS_APPROVAL_CLASS_WEIGHT as Record<string, number>;
  for (const sc of state.socialClasses ?? []) {
    sc.approval = Math.max(0, Math.round((sc.approval - base * (weights[sc.key] ?? 1)) * 10) / 10);
  }
}

/** Condición de apertura: no se pueden pagar los intereses con comodidad, o la deuda es insostenible. */
export function debtCrisisCondition(
  state: Pick<GameState, "ministries" | "publicDebt" | "gdp" | "creditScore">,
  monthlyRevenue: number,
): boolean {
  const debt = state.publicDebt ?? 0;
  if (!(debt > 0)) return false;
  const burden = interestBurden(monthlyDebtInterest(state), monthlyRevenue);
  return burden >= BALANCE.DEBT_CRISIS_INTEREST_BURDEN || debtToGdp(debt, state.gdp) >= BALANCE.DEBT_CRISIS_DEBT_GDP;
}

/** Austeridad: recorta todos los presupuestos ministeriales, golpea la aprobación y da confianza a los mercados. */
function applyAusterity(state: GameState): TurnNotification[] {
  for (const m of state.ministries) {
    const cut = m.budgetPercent * (1 - BALANCE.AUSTERITY_BUDGET_CUT);
    m.budgetPercent = Math.max(BALANCE.MIN_BUDGET_PERCENT, Math.round(cut * 10) / 10);
  }
  hitApproval(state, BALANCE.AUSTERITY_APPROVAL_HIT);
  state.creditScore = Math.min(100, (state.creditScore ?? 0) + BALANCE.AUSTERITY_SCORE_BONUS);
  state.debtCrisisMonths = 0;
  state.debtCrisisCooldown = BALANCE.DEBT_CRISIS_COOLDOWN_MONTHS;
  return [{
    type: "crisis",
    title: "Plan de austeridad",
    description: `Se recortaron ${Math.round(BALANCE.AUSTERITY_BUDGET_CUT * 100)}% de todos los presupuestos ministeriales. Los mercados lo valoran (calificación ${ratingFromScore(state.creditScore) ?? "—"}), pero el recorte golpea la aprobación, sobre todo en las clases bajas. Los presupuestos quedan recortados hasta que los modifiques.`,
  }];
}

/** Default: quita de la deuda, calificación al piso, mercados cerrados, sanciones e inflación. */
function applyDefault(state: GameState, automatic: boolean): TurnNotification[] {
  const before = state.publicDebt ?? 0;
  state.publicDebt = before * (1 - BALANCE.DEFAULT_HAIRCUT);
  state.creditScore = BALANCE.DEFAULT_SCORE;
  state.monthsSinceDefault = 0;
  state.marketsClosedMonths = BALANCE.DEFAULT_MARKET_CLOSURE_MONTHS;
  state.debtCrisisMonths = 0;
  state.debtCrisisCooldown = BALANCE.DEBT_CRISIS_COOLDOWN_MONTHS;
  state.sanctionsMultiplier = Math.max(state.sanctionsMultiplier ?? 1, BALANCE.DEFAULT_SANCTIONS_MULTIPLIER);
  state.inflation = Math.min(100, state.inflation + BALANCE.DEFAULT_INFLATION_SHOCK);
  hitApproval(state, BALANCE.DEFAULT_APPROVAL_HIT);
  return [{
    type: "crisis",
    title: automatic ? "Default automático" : "Default de la deuda pública",
    description: `${automatic ? "Pasó el plazo sin una respuesta a la crisis de deuda: el país cae en default. " : "El país declara el default. "}La deuda se reduce ${Math.round(BALANCE.DEFAULT_HAIRCUT * 100)}% (de ${mM(before)} a ${mM(state.publicDebt)}), la calificación cae a D, los mercados se cierran ${BALANCE.DEFAULT_MARKET_CLOSURE_MONTHS} meses (el déficit se financiará imprimiendo dinero), llegan sanciones comerciales y la inflación se dispara.`,
    severity: 1,
  }];
}

/**
 * Aplica la respuesta del jugador a la crisis abierta (paso 1 del turno). Sin crisis abierta se ignora,
 * y una respuesta que no es AUSTERITY ni DEFAULT también (el cliente no es de fiar).
 */
export function applyDebtCrisisResponse(state: GameState, response: unknown): TurnNotification[] {
  if (!isDebtCrisisOpen(state)) {
    return response === undefined || response === null ? [] : [{
      type: "warning",
      title: "Respuesta ignorada",
      description: "No hay una crisis de deuda abierta: la respuesta no se aplicó.",
    }];
  }
  if (response === "AUSTERITY") return applyAusterity(state);
  if (response === "DEFAULT") return applyDefault(state, false);
  return [];
}

/**
 * Cierra la caja del mes con la deuda: con los mercados abiertos, el faltante se cubre con deuda y el
 * superávit amortiza (settlePublicDebt); con los mercados cerrados nadie presta, así que el faltante
 * se cubre imprimiendo dinero (el tesoro queda en 0 y la inflación sube) y solo se amortiza.
 */
export function settleMonth(
  state: GameState,
  monthlyExpenses: number,
  monthlyRevenue: number,
): { issued: number; amortized: number; monetized: number } {
  if (!areMarketsClosed(state)) return { ...settlePublicDebt(state, monthlyExpenses), monetized: 0 };

  let monetized = 0;
  if (Number.isFinite(state.treasury) && state.treasury < 0) {
    monetized = -state.treasury;
    state.treasury = 0;
    const pct = monthlyRevenue > 0 ? (monetized / monthlyRevenue) * 100 : 100;
    // Misma relación que el primer mes de una emisión voluntaria (monetary.ts): presión de equilibrio ×
    // velocidad de ajuste × credibilidad (con un Banco Central creíble la inflación se contagia menos)
    const credibility = monetaryCredibility(state.organisms ?? []);
    state.inflation = Math.min(100, state.inflation
      + BALANCE.INFLATION_EMISSION_FACTOR * pct * BALANCE.INFLATION_ADJUST * credibility);
  }
  const { amortized } = settlePublicDebt(state, monthlyExpenses);
  return { issued: 0, amortized, monetized };
}

export interface MonthContext {
  /** Recaudación del mes */
  monthlyRevenue: number;
  /** Gasto del mes */
  monthlyExpenses: number;
}

/** Actualiza el puntaje de calificación del mes con los fundamentos ya calculados (después de cerrar la caja). */
export function updateCreditScore(state: GameState, ctx: MonthContext): void {
  const revenue = Math.max(0, ctx.monthlyRevenue);
  const deficitPct = revenue > 0
    ? (Math.max(0, ctx.monthlyExpenses - revenue) / revenue) * 100
    : ctx.monthlyExpenses > 0 ? 100 : 0;
  const credibility = (monetaryCredibility(state.organisms ?? []) - BALANCE.MONETARY_CRED_MIN)
    / (BALANCE.MONETARY_CRED_MAX - BALANCE.MONETARY_CRED_MIN);
  const { target } = creditScoreTarget({
    debtToGdp: debtToGdp(state.publicDebt ?? 0, state.gdp),
    deficitPct,
    inflation: state.inflation,
    interestBurden: interestBurden(monthlyDebtInterest(state), revenue),
    approval: currentApproval(state),
    corruption: calculateGlobalCorruption(state.officials ?? []),
    povertyRate: state.povertyRate,
    monthsSinceDefault: state.monthsSinceDefault ?? null,
    centralBankCredibility: credibility,
  });
  state.creditScore = nextCreditScore(state.creditScore, target);
}

/**
 * Fin de turno: cuenta atrás de mercados cerrados y enfriamiento, memoria del default, plazo de la crisis
 * abierta (default automático al vencer) y apertura de una crisis nueva. Llamar después de updateCreditScore.
 */
export function advanceDebtCrisis(state: GameState, ctx: MonthContext): TurnNotification[] {
  const notifications: TurnNotification[] = [];

  if (state.monthsSinceDefault !== null && state.monthsSinceDefault !== undefined) state.monthsSinceDefault += 1;
  if ((state.debtCrisisCooldown ?? 0) > 0) state.debtCrisisCooldown = (state.debtCrisisCooldown ?? 0) - 1;

  if (areMarketsClosed(state)) {
    state.marketsClosedMonths = (state.marketsClosedMonths ?? 0) - 1;
    if (state.marketsClosedMonths <= 0) {
      state.marketsClosedMonths = 0;
      state.sanctionsMultiplier = BALANCE.TRADE_SANCTIONS_MULTIPLIER;
      notifications.push({
        type: "info",
        title: "Los mercados reabren",
        description: "Terminó el cierre de mercados tras el default: el país vuelve a poder financiarse con deuda y se levantan las sanciones comerciales.",
      });
    }
  }

  if (isDebtCrisisOpen(state)) {
    state.debtCrisisMonths = (state.debtCrisisMonths ?? 0) + 1;
    if (state.debtCrisisMonths > BALANCE.DEBT_CRISIS_GRACE_MONTHS) {
      notifications.push(...applyDefault(state, true));
    } else {
      const left = BALANCE.DEBT_CRISIS_GRACE_MONTHS + 1 - state.debtCrisisMonths;
      notifications.push({
        type: "crisis",
        title: "Crisis de deuda sin respuesta",
        description: `Los mercados siguen cerrados al crédito. Elige austeridad o default: si no respondes, el país cae en default automático en ${left} mes${left === 1 ? "" : "es"}.`,
      });
    }
    return notifications;
  }

  if ((state.debtCrisisCooldown ?? 0) === 0 && !areMarketsClosed(state) && debtCrisisCondition(state, ctx.monthlyRevenue)) {
    state.debtCrisisMonths = 1;
    const burden = interestBurden(monthlyDebtInterest(state), ctx.monthlyRevenue);
    notifications.push({
      type: "crisis",
      title: "Crisis de deuda",
      description: `Los intereses consumen ${Number.isFinite(burden) ? Math.round(burden * 100) : "toda la"}% de la recaudación (deuda ${Math.round(debtToGdp(state.publicDebt ?? 0, state.gdp) * 100)}% del PIB, calificación ${ratingFromScore(state.creditScore) ?? "—"}) y los mercados dejan de prestar. Debes elegir: austeridad (recortar presupuestos y aprobación) o default (quita de la deuda, sanciones, cierre de mercados). Tienes ${BALANCE.DEBT_CRISIS_GRACE_MONTHS} meses.`,
      severity: 0.8,
    });
  }
  return notifications;
}
