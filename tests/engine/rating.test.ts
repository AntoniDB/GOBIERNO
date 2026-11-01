import { describe, it, expect } from "vitest";
import { BALANCE } from "@/lib/balance";
import {
  RATINGS, creditScoreTarget, interestBurden, isSpeculativeGrade, nextCreditScore, ratingFromScore, ratingSpread,
  type RatingInputs,
} from "@/lib/engine/rating";

const sano: RatingInputs = {
  debtToGdp: 0, deficitPct: 0, inflation: 3, interestBurden: 0, approval: 60, corruption: 10, povertyRate: 15,
  monthsSinceDefault: null, centralBankCredibility: 0,
};

describe("letra y diferencial", () => {
  it("cada umbral da su letra, de AAA a D", () => {
    BALANCE.RATING_THRESHOLDS.forEach((min, i) => {
      expect(ratingFromScore(min)).toBe(RATINGS[i]);
      expect(ratingFromScore(min - 0.01)).toBe(RATINGS[i + 1]);
    });
    expect(ratingFromScore(100)).toBe("AAA");
    expect(ratingFromScore(0)).toBe("D");
  });

  it("sin puntaje no hay calificación ni diferencial", () => {
    expect(ratingFromScore(null)).toBeNull();
    expect(ratingFromScore(undefined)).toBeNull();
    expect(ratingFromScore(Number.NaN)).toBeNull();
    expect(ratingSpread(null)).toBe(0);
  });

  it("el diferencial sube al bajar la letra y vale RATING_SPREADS", () => {
    const spreads = RATINGS.map((r) => BALANCE.RATING_SPREADS[r]);
    for (let i = 1; i < spreads.length; i++) expect(spreads[i]).toBeGreaterThan(spreads[i - 1]);
    expect(ratingSpread(95)).toBe(BALANCE.RATING_SPREADS.AAA);
    expect(ratingSpread(10)).toBe(BALANCE.RATING_SPREADS.D);
  });

  it("grado especulativo desde BB", () => {
    expect(isSpeculativeGrade(BALANCE.RATING_THRESHOLDS[3])).toBe(false); // BBB
    expect(isSpeculativeGrade(BALANCE.RATING_THRESHOLDS[4])).toBe(true); // BB
    expect(isSpeculativeGrade(null)).toBe(false);
  });
});

describe("puntaje objetivo", () => {
  it("un país sano solo paga el riesgo estructural", () => {
    const r = creditScoreTarget(sano);
    expect(r.target).toBeCloseTo(100 - BALANCE.RATING_BASE_PENALTY, 10);
    expect(r.debt + r.deficit + r.inflation + r.burden + r.approval + r.corruption + r.poverty).toBe(0);
  });

  it.each([
    ["debtToGdp", 1.5, "debt", BALANCE.RATING_W_DEBT],
    ["deficitPct", 50, "deficit", BALANCE.RATING_W_DEFICIT],
    ["inflation", 80, "inflation", BALANCE.RATING_W_INFLATION],
    ["interestBurden", 1, "burden", BALANCE.RATING_W_BURDEN],
    ["approval", 0, "approval", BALANCE.RATING_W_APPROVAL],
    ["corruption", 100, "corruption", BALANCE.RATING_W_CORRUPTION],
    ["povertyRate", 100, "poverty", BALANCE.RATING_W_POVERTY],
  ] as const)("%s extremo penaliza exactamente su peso máximo (%s)", (campo, valor, clave, peso) => {
    const r = creditScoreTarget({ ...sano, [campo]: valor });
    expect(r[clave]).toBeCloseTo(peso, 10);
  });

  it("las penalizaciones crecen de forma monótona con el indicador", () => {
    for (const [campo, a, b] of [["debtToGdp", 0.5, 0.9], ["deficitPct", 5, 15], ["inflation", 10, 20], ["interestBurden", 0.1, 0.25], ["corruption", 30, 50], ["povertyRate", 30, 45]] as const) {
      expect(creditScoreTarget({ ...sano, [campo]: b }).target).toBeLessThan(creditScoreTarget({ ...sano, [campo]: a }).target);
    }
    expect(creditScoreTarget({ ...sano, approval: 10 }).target).toBeLessThan(creditScoreTarget({ ...sano, approval: 30 }).target);
  });

  it("sin recaudación (carga infinita) cuenta como el máximo; un valor NaN no penaliza", () => {
    expect(creditScoreTarget({ ...sano, interestBurden: Infinity }).burden).toBe(BALANCE.RATING_W_BURDEN);
    expect(creditScoreTarget({ ...sano, inflation: Number.NaN }).inflation).toBe(0);
  });

  it("la memoria de un default se olvida a lo largo de RATING_DEFAULT_MEMORY_MONTHS", () => {
    const recien = creditScoreTarget({ ...sano, monthsSinceDefault: 0 }).defaultMemory;
    const mitad = creditScoreTarget({ ...sano, monthsSinceDefault: BALANCE.RATING_DEFAULT_MEMORY_MONTHS / 2 }).defaultMemory;
    expect(recien).toBe(BALANCE.RATING_W_DEFAULT);
    expect(mitad).toBeCloseTo(BALANCE.RATING_W_DEFAULT / 2, 10);
    expect(creditScoreTarget({ ...sano, monthsSinceDefault: 999 }).defaultMemory).toBe(0);
  });

  it("un Banco Central creíble suma su bono; el puntaje queda en [0, 100]", () => {
    const con = creditScoreTarget({ ...sano, centralBankCredibility: 1 });
    expect(con.centralBankBonus).toBe(BALANCE.RATING_CENTRAL_BANK_BONUS);
    expect(con.target).toBeCloseTo(100 - BALANCE.RATING_BASE_PENALTY + BALANCE.RATING_CENTRAL_BANK_BONUS, 10);
    expect(creditScoreTarget({ ...sano, debtToGdp: 9, deficitPct: 99, inflation: 99, interestBurden: 9, approval: 0, corruption: 99, povertyRate: 99, monthsSinceDefault: 0 }).target).toBe(0);
    expect(creditScoreTarget({ ...sano, centralBankCredibility: 1 }).target).toBeLessThanOrEqual(100);
  });
});

describe("inercia del puntaje", () => {
  it("sin puntaje previo arranca en el objetivo", () => {
    expect(nextCreditScore(null, 63)).toBe(63);
    expect(nextCreditScore(Number.NaN, 63)).toBe(63);
  });

  it("baja más rápido de lo que sube", () => {
    const baja = 80 - nextCreditScore(80, 40);
    const sube = nextCreditScore(40, 80) - 40;
    expect(baja).toBeCloseTo(40 * BALANCE.RATING_INERTIA_DOWN, 10);
    expect(sube).toBeCloseTo(40 * BALANCE.RATING_INERTIA_UP, 10);
    expect(baja).toBeGreaterThan(sube);
  });

  it("converge al objetivo y se mantiene en [0, 100]", () => {
    let s = 90;
    for (let i = 0; i < 40; i++) s = nextCreditScore(s, 30);
    expect(s).toBeCloseTo(30, 1);
    expect(nextCreditScore(5, -50)).toBeGreaterThanOrEqual(0);
    expect(nextCreditScore(95, 500)).toBeLessThanOrEqual(100);
  });
});

describe("carga de intereses", () => {
  it("intereses / recaudación; sin deuda 0; sin recaudación infinita", () => {
    expect(interestBurden(300, 1000)).toBe(0.3);
    expect(interestBurden(0, 1000)).toBe(0);
    expect(interestBurden(0, 0)).toBe(0);
    expect(interestBurden(10, 0)).toBe(Infinity);
  });
});
