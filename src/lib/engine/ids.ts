// ─── Ids de entidades que crea el motor ──────────────────────────────────────
// El motor crea candidatos, organismos, casos judiciales, decisiones de varios meses y
// programas, y la persistencia los guarda con `upsert` por id. Antes los ids eran solo
// `prefijo-año-mes-índice`: dos partidas que creaban algo el mismo mes de juego generaban el
// mismo id y la segunda pisaba la fila de la primera (KNOWN_ISSUES #22). Ahora el id lleva la
// partida: gameId (único, la clave primaria de Game) o, sin él (tests), el seed de la partida.
// Sigue siendo determinista: misma partida y mismo mes → mismo id.

import type { GameState } from "./types";

export function entityId(
  state: Pick<GameState, "seed"> & { gameId?: string },
  prefix: string,
  ...parts: Array<string | number>
): string {
  return [prefix, state.gameId ?? state.seed, ...parts].join("-");
}
