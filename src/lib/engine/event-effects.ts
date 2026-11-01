// ─── Efectos de los eventos sobre el estado (Issue 26) ───────────────────────
// Los eventos declaraban efectos (corrupción, reputación, subordinación militar, libertades civiles…) que
// ningún código leía. Los que no son un choque de indicador (shocks.ts) se aplican aquí, al estado persistente:
//   - corrupción: cada funcionario ACTIVO suma `corruptionDelta` (la corrupción persiste por funcionario y la
//     reducen la Contraloría y la Fiscalía; es la corrupción que el escándalo saca a la luz);
//   - reputación: pierden `reputationDelta` los EVENT_SCANDAL_EXPOSED_OFFICIALS funcionarios activos más corruptos;
//   - régimen: subordinación militar y libertades civiles suben o bajan y se regeneran solas (regime.ts).

import { BALANCE } from "../balance";
import type { GameState } from "./types";
import type { EventEffectsDelta } from "./events";

const clamp100 = (v: number) => Math.max(0, Math.min(100, v));

export function applyEventStateEffects(
  state: Pick<GameState, "officials" | "regimeMetrics">,
  deltas: Pick<EventEffectsDelta, "corruptionDelta" | "reputationDelta" | "militarySubordinationDelta" | "civilLibertiesDelta">,
): void {
  const active = state.officials.filter((o) => o.status === "ACTIVE");

  if (deltas.corruptionDelta !== 0) {
    for (const o of active) o.corruption = clamp100(o.corruption + deltas.corruptionDelta);
  }

  if (deltas.reputationDelta > 0) {
    // Los más corruptos (desempate por id: determinista) cargan con la exposición
    const exposed = [...active]
      .sort((a, b) => b.corruption - a.corruption || a.id.localeCompare(b.id))
      .slice(0, BALANCE.EVENT_SCANDAL_EXPOSED_OFFICIALS);
    for (const o of exposed) o.reputation = clamp100(o.reputation - deltas.reputationDelta);
  }

  const metrics = state.regimeMetrics;
  if (deltas.militarySubordinationDelta !== 0) {
    metrics.militarySubordination = clamp100(metrics.militarySubordination + deltas.militarySubordinationDelta);
  }
  if (deltas.civilLibertiesDelta !== 0) {
    metrics.civilLiberties = clamp100(metrics.civilLiberties + deltas.civilLibertiesDelta);
  }
}
