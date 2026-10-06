import { describe, it, expect, vi } from "vitest";
import {
  updateMinistries, upsertOfficials, updateSocialClasses, updateRegions,
  updateDiseases, upsertDiseasePrevalences, upsertResourceStocks,
} from "@/app/actions/turn-batch";
import { persistTurn } from "@/app/actions/turn-persistence";
import { getTransactionOptions } from "@/lib/db-config";

// tx simulado: registra cada sentencia SQL (plantilla etiquetada) y cada operación de modelo
function fakeTx() {
  const sql: { text: string; values: unknown[] }[] = [];
  const ops: string[] = [];
  const executeRaw = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    sql.push({ text: strings.join("?"), values });
    ops.push("$executeRaw");
    return 0;
  });
  const model = (name: string) =>
    new Proxy({}, { get: (_t, method: string) => async () => { ops.push(`${name}.${method}`); return null; } });
  const tx = new Proxy({ $executeRaw: executeRaw } as Record<string, unknown>, {
    get: (t, p: string) => (p in t ? t[p] : model(p)),
  });
  return { tx, sql, ops };
}

const ministerio = (i: number, extra = {}) => ({
  id: `m${i}`, efficiency: 50 + i, internalCorruption: 10, subDecisions: { a: i }, budgetPercent: 12.5,
  ministerOfficialId: i % 2 ? `o${i}` : null, producedResources: {}, consumedResources: {}, healthBudgetSplit: undefined, ...extra,
});
const oficial = (i: number, extra = {}) => ({
  id: `o${i}`, name: `Oficial ${i}`, role: "MINISTER", specialty: null, status: "ACTIVE", corruption: 5, skill: 60,
  loyalty: 50, ambition: 30, wealth: 1000, reputation: 50, ideology: { economic: 0, social: 0, authority: 0 },
  ministryId: null, partyId: null, ...extra,
});

describe("escrituras agrupadas: una sentencia por tabla", () => {
  it("sin filas no se envía nada", async () => {
    const { tx, sql } = fakeTx();
    await updateMinistries(tx, []); await upsertOfficials(tx, "g", []); await updateSocialClasses(tx, []);
    await updateRegions(tx, []); await updateDiseases(tx, []); await upsertDiseasePrevalences(tx, "g", []);
    await upsertResourceStocks(tx, "g", []);
    expect(sql).toHaveLength(0);
  });

  it("N filas → 1 sentencia, con arrays paralelos de N elementos", async () => {
    const { tx, sql } = fakeTx();
    await updateMinistries(tx, Array.from({ length: 8 }, (_, i) => ministerio(i)));
    await upsertOfficials(tx, "g", Array.from({ length: 30 }, (_, i) => oficial(i)));
    expect(sql).toHaveLength(2);
    expect(sql[0].values.every((v) => Array.isArray(v) && v.length === 8)).toBe(true);
    // el 1º valor de upsertOfficials es el gameId; el resto, arrays de 30
    const arrays = sql[1].values.filter(Array.isArray);
    expect(arrays).toHaveLength(14);
    expect(arrays.every((a) => a.length === 30)).toBe(true);
  });

  it("los números van como texto y conservan NaN/Infinity (como el update por fila de antes)", async () => {
    const { tx, sql } = fakeTx();
    await upsertOfficials(tx, "g", [oficial(1, { skill: NaN }), oficial(2, { skill: 60 }), oficial(3, { skill: undefined })]);
    const skills = (sql[0].values.filter(Array.isArray) as unknown[][])[6];
    expect(skills).toEqual(["NaN", "60", "50"]); // undefined → 50, como `o.skill ?? 50`
    expect(sql[0].text).toContain("::text[]::float8[]");
  });

  it("las columnas Json viajan como texto y undefined se conserva con COALESCE", async () => {
    const { tx, sql } = fakeTx();
    await updateMinistries(tx, [ministerio(1)]);
    const arrays = sql[0].values as unknown[][];
    expect(arrays[3]).toEqual([JSON.stringify({ a: 1 })]);   // subDecisions
    expect(arrays[8]).toEqual([null]);                        // healthBudgetSplit undefined → no se toca
    expect(sql[0].text).toContain('COALESCE(v."healthBudgetSplit"::jsonb, t."healthBudgetSplit")');
  });

  it("los upserts por clave natural ignoran duplicados (la última gana) para no romper ON CONFLICT", async () => {
    const { tx, sql } = fakeTx();
    await upsertResourceStocks(tx, "g", [{ resourceType: "x", quantity: 1 }, { resourceType: "x", quantity: 2 }, { resourceType: "y", quantity: 3 }]);
    await upsertDiseasePrevalences(tx, "g", [{ diseaseId: "d", currentPrevalence: 1 }, { diseaseId: "d", currentPrevalence: 5 }]);
    const stock = sql[0].values.filter(Array.isArray) as unknown[][];
    expect(stock[1]).toEqual(["x", "y"]);
    expect(stock[2]).toEqual(["2", "3"]);
    expect((sql[1].values.filter(Array.isArray) as unknown[][])[2]).toEqual(["5"]);
  });

  it("las Official se insertan con los casts de enum y el upsert actualiza lo mismo que el upsert por fila", async () => {
    const { tx, sql } = fakeTx();
    await upsertOfficials(tx, "g", [oficial(1)]);
    const text = sql[0].text;
    expect(text).toContain('v."role"::"OfficialRole"');
    expect(text).toContain('v."status"::"OfficialStatus"');
    for (const col of ["corruption", "status", "wealth", "reputation", "ministryId", "partyId", "role", "specialty", "loyalty", "ambition", "skill", "ideology"]) {
      expect(text).toContain(`"${col}" = EXCLUDED."${col}"`);
    }
    expect(text).not.toContain('"name" = EXCLUDED'); // el nombre no se actualiza (igual que antes)
  });
});

describe("persistTurn: presupuesto de operaciones", () => {
  const ctx = (over = {}) => ({
    gameId: "g", game: { currentYear: 1, currentMonth: 3 }, newYear: 1, newMonth: 4, gameOver: false,
    newState: {
      ministries: Array.from({ length: 8 }, (_, i) => ministerio(i)),
      officials: Array.from({ length: 30 }, (_, i) => oficial(i)),
      socialClasses: Array.from({ length: 4 }, (_, i) => ({ id: `c${i}`, approval: 50, populationPercent: 25, educationLevel: 30, healthAccess: 50, averageIncome: 0, demands: [] })),
      regimeMetrics: { powerConcentration: 1, pressFreedom: 1, judicialIndependence: 1, politicalPluralism: 1, civilLiberties: 1, transparency: 1, militarySubordination: 1 },
      treasury: 1, population: 1, longRunningDecisions: [], resourceStocks: Array.from({ length: 3 }, (_, i) => ({ resourceType: `r${i}`, quantity: i })),
      tradeFlows: [], regions: Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, povertyRate: 1, infrastructureLevel: 1, healthCoverage: {} })),
      diseasePrevalences: Array.from({ length: 14 }, (_, i) => ({ diseaseId: `d${i}`, currentPrevalence: i })),
      diseases: Array.from({ length: 14 }, (_, i) => ({ id: `d${i}`, hasVaccine: false, mortalityRate: 0.01 })),
      programs: [], judicialCases: [], organisms: [],
    },
    monthSnapshot: { regimeMetrics: {}, diseasePrevalences: [] },
    newEvents: Array.from({ length: 3 }, () => ({ type: "PROTEST", severity: 10, year: 1, month: 3, description: "d", effectsApplied: {}, resolvedAt: null })),
    mediaCoverages: Array.from({ length: 4 }, () => ({ mediaId: "m", headline: "h", sentiment: 0, impactOnApproval: {} })),
    lawResults: [{ lawKey: "a", approved: true, votesFor: 1, votesAgainst: 0, votesAbstain: 0 }, { lawKey: "b", approved: false, votesFor: 0, votesAgainst: 1, votesAbstain: 0 }],
    enactedKeys: ["a"], ...over,
  });

  it("un turno típico guarda con ≤ 20 operaciones (antes ≈ 85: una por fila)", async () => {
    const { tx, ops } = fakeTx();
    await persistTurn(tx, ctx());
    expect(ops.length).toBeLessThanOrEqual(20);
    expect(ops.filter((o) => o.startsWith("event.") || o.startsWith("mediaCoverage.") || o.startsWith("lawProposal.") || o.startsWith("activeLaw."))
      .sort()).toEqual(["activeLaw.createMany", "event.createMany", "lawProposal.createMany", "mediaCoverage.createMany"]);
  });

  it("el número de operaciones no crece con el número de filas agrupadas", async () => {
    const small = fakeTx(); await persistTurn(small.tx, ctx());
    const big = fakeTx();
    const c = ctx();
    c.newState.officials = Array.from({ length: 300 }, (_, i) => oficial(i));
    c.newEvents = Array.from({ length: 40 }, () => c.newEvents[0]);
    await persistTurn(big.tx, c);
    expect(big.ops.length).toBe(small.ops.length);
  });

  it("solo la ley recién promulgada crea ActiveLaw, y una vez", async () => {
    type Call = { model: string; args: { data: { lawKey: string }[] } };
    const calls: Call[] = [];
    const tx = new Proxy({ $executeRaw: async () => 0 } as Record<string, unknown>, {
      get: (t, p: string) => (p in t ? t[p] : new Proxy({}, { get: (_m, method: string) => async (args: Call["args"]) => { calls.push({ model: `${p}.${method}`, args }); return null; } })),
    });
    const c = ctx({ lawResults: [
      { lawKey: "a", approved: true, votesFor: 1, votesAgainst: 0, votesAbstain: 0 },
      { lawKey: "a", approved: true, votesFor: 1, votesAgainst: 0, votesAbstain: 0 },
      { lawKey: "b", approved: true, votesFor: 1, votesAgainst: 0, votesAbstain: 0 },
    ], enactedKeys: ["a"] });
    await persistTurn(tx, c);
    expect(calls.find((x) => x.model === "activeLaw.createMany")!.args.data.map((d) => d.lawKey)).toEqual(["a"]);
    expect(calls.find((x) => x.model === "lawProposal.createMany")!.args.data).toHaveLength(3);
  });
});

describe("getTransactionOptions", () => {
  it("por defecto 60 s de timeout y 10 s de espera (Prisma corta a 5 s)", () => {
    expect(getTransactionOptions({})).toEqual({ maxWait: 10_000, timeout: 60_000 });
  });
  it("se configura por entorno y valida", () => {
    expect(getTransactionOptions({ DATABASE_TRANSACTION_TIMEOUT_MS: "120000", DATABASE_TRANSACTION_MAX_WAIT_MS: "2000" })).toEqual({ maxWait: 2000, timeout: 120_000 });
    expect(() => getTransactionOptions({ DATABASE_TRANSACTION_TIMEOUT_MS: "-1" })).toThrow(/DATABASE_TRANSACTION_TIMEOUT_MS/);
  });
});
