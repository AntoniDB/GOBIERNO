// ─── Generador determinista sembrado (PRNG) ────────────────────────────────
// Implementación: mulberry32 — rápido, buen período, determinista.
// Usado para todos los rolls aleatorios del motor de simulación.
// Misma semilla + mismas entradas = mismo resultado SIEMPRE.

/**
 * Crea un PRNG determinista basado en mulberry32.
 * @param seed - Semilla string (se convierte a entero de 32 bits)
 * @returns Función que devuelve número pseudoaleatorio en [0, 1)
 */
export function createRNG(seed: string): () => number {
  let state = hashStringToU32(seed);

  return function mulberry32(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hash simple de string a entero 32 bits sin signo.
 */
function hashStringToU32(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash >>> 0;
}

/**
 * Devuelve un entero aleatorio en [min, max] (inclusive).
 */
export function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Devuelve `true` con la probabilidad dada (0 a 1).
 */
export function rollChance(rng: () => number, probability: number): boolean {
  return rng() < probability;
}

/**
 * Mezcla un array de forma determinista (Fisher-Yates sembrado).
 */
export function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Selecciona un elemento aleatorio del array.
 */
export function randomPick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}
