import { describe, it, expect } from "vitest";
import { createRNG, randomInt, rollChance, seededShuffle, randomPick } from "@/lib/rng";

describe("createRNG", () => {
  it("produce la misma secuencia con la misma semilla", () => {
    const rng1 = createRNG("semilla-fija");
    const rng2 = createRNG("semilla-fija");
    const seq1 = Array.from({ length: 20 }, () => rng1());
    const seq2 = Array.from({ length: 20 }, () => rng2());
    expect(seq1).toEqual(seq2);
  });

  it("produce secuencias diferentes con semillas diferentes", () => {
    const rng1 = createRNG("semilla-uno");
    const rng2 = createRNG("semilla-dos");
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    const iguales = seq1.every((v, i) => v === seq2[i]);
    expect(iguales).toBe(false);
  });

  it("devuelve valores en el rango [0, 1)", () => {
    const rng = createRNG("rango-test");
    for (let i = 0; i < 1000; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});

describe("randomInt", () => {
  it("devuelve valores en el rango [min, max] inclusive", () => {
    const rng = createRNG("int-test");
    for (let i = 0; i < 500; i++) {
      const val = randomInt(rng, 5, 10);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThanOrEqual(10);
    }
  });

  it("devuelve el mismo valor cuando min === max", () => {
    const rng = createRNG("int-igual");
    for (let i = 0; i < 20; i++) {
      expect(randomInt(rng, 7, 7)).toBe(7);
    }
  });
});

describe("rollChance", () => {
  it("con probabilidad 1.0 siempre devuelve true", () => {
    const rng = createRNG("always-true");
    for (let i = 0; i < 100; i++) {
      expect(rollChance(rng, 1.0)).toBe(true);
    }
  });

  it("con probabilidad 0.0 siempre devuelve false", () => {
    const rng = createRNG("always-false");
    for (let i = 0; i < 100; i++) {
      expect(rollChance(rng, 0.0)).toBe(false);
    }
  });
});

describe("seededShuffle", () => {
  it("devuelve los mismos elementos que el array original", () => {
    const rng = createRNG("shuffle-todos");
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = seededShuffle(original, rng);
    expect(shuffled.length).toBe(original.length);
    expect(shuffled.sort((a, b) => a - b)).toEqual(original.sort((a, b) => a - b));
  });

  it("es determinista con la misma semilla", () => {
    const original = ["a", "b", "c", "d", "e", "f"];
    const rng1 = createRNG("shuffle-det");
    const rng2 = createRNG("shuffle-det");
    const shuf1 = seededShuffle(original, rng1);
    const shuf2 = seededShuffle(original, rng2);
    expect(shuf1).toEqual(shuf2);
  });

  it("no modifica el array original", () => {
    const original = [1, 2, 3, 4, 5];
    const copia = [...original];
    const rng = createRNG("shuffle-inmutable");
    seededShuffle(original, rng);
    expect(original).toEqual(copia);
  });
});

describe("randomPick", () => {
  it("devuelve un elemento del array", () => {
    const rng = createRNG("pick");
    const arr = ["x", "y", "z"];
    const picked = randomPick(arr, rng);
    expect(arr).toContain(picked);
  });
});
