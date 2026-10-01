import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  SUB_DECISION_SPECS,
  validateSubDecision,
  applySubDecisionChanges,
  numberRange,
} from "@/lib/engine/sub-decisions";
import { generateMinistries } from "@/lib/game-factory";

describe("validateSubDecision", () => {
  it("acepta un booleano y un número dentro de rango", () => {
    expect(validateSubDecision("HEALTH", "vacunacion", true)).toEqual({ ok: true, value: true });
    expect(validateSubDecision("ECONOMY", "tasaInteres", 7.5)).toEqual({ ok: true, value: 7.5 });
  });

  it("acota los números al rango", () => {
    expect(validateSubDecision("SECURITY", "patrullajeUrbano", 500)).toEqual({ ok: true, value: 100 });
    expect(validateSubDecision("SECURITY", "patrullajeUrbano", -3)).toEqual({ ok: true, value: 0 });
    expect(validateSubDecision("ECONOMY", "salarioMinimo", 1e12)).toEqual({ ok: true, value: 10_000 });
    expect(validateSubDecision("ECONOMY", "tasaInteres", 0)).toEqual({ ok: true, value: 1 });
  });

  it.each([
    ["número donde va un booleano", "HEALTH", "vacunacion", 1],
    ["texto donde va un booleano", "HEALTH", "vacunacion", "true"],
    ["booleano donde va un número", "ECONOMY", "tasaInteres", true],
    ["texto numérico", "ECONOMY", "tasaInteres", "5"],
    ["NaN", "ECONOMY", "tasaInteres", NaN],
    ["Infinity", "ECONOMY", "tasaInteres", Infinity],
    ["null", "ECONOMY", "tasaInteres", null],
    ["undefined", "ECONOMY", "tasaInteres", undefined],
    ["clave de otro ministerio", "HEALTH", "tasaInteres", 5],
    ["clave inventada", "HEALTH", "dineroGratis", 1],
    ["clave heredada de Object", "HEALTH", "constructor", 1],
    ["__proto__", "HEALTH", "__proto__", 1],
    ["ministerio inventado", "NOPE", "vacunacion", true],
    ["ministerio heredado de Object", "constructor", "vacunacion", true],
  ])("rechaza: %s", (_nombre, ministry, key, value) => {
    expect(validateSubDecision(ministry, key, value).ok).toBe(false);
  });
});

describe("applySubDecisionChanges", () => {
  const ministerios = () => [
    { key: "HEALTH", subDecisions: { vacunacion: true, saludMental: false } as Record<string, number | boolean> },
    { key: "ECONOMY", subDecisions: { tasaInteres: 4.5 } as Record<string, number | boolean> },
  ];

  it("aplica lo válido, descarta lo inválido y devuelve los motivos", () => {
    const ms = ministerios();
    const rejections = applySubDecisionChanges(ms, {
      HEALTH: { saludMental: true, basura: 1 },
      ECONOMY: { tasaInteres: 99 },
    });
    expect(ms[0].subDecisions).toEqual({ vacunacion: true, saludMental: true });
    expect(ms[1].subDecisions).toEqual({ tasaInteres: 20 });
    expect(rejections).toHaveLength(1);
    expect(rejections[0]).toContain("basura");
  });

  it("un ministerio válido que no existe en la partida se ignora sin error", () => {
    const ms = ministerios();
    expect(applySubDecisionChanges(ms, { DEFENSE: { servicioMilitar: true } })).toEqual([]);
  });

  it("un ministerio desconocido se rechaza", () => {
    expect(applySubDecisionChanges(ministerios(), { NOPE: { x: 1 } })).toHaveLength(1);
  });

  it("no ensucia el objeto con claves heredadas", () => {
    const ms = ministerios();
    applySubDecisionChanges(ms, { HEALTH: JSON.parse('{"__proto__": 1, "constructor": 2}') });
    expect(Object.keys(ms[0].subDecisions).sort()).toEqual(["saludMental", "vacunacion"]);
  });

  it("acepta undefined o un valor que no es objeto", () => {
    const ms = ministerios();
    expect(applySubDecisionChanges(ms, undefined)).toEqual([]);
    expect(applySubDecisionChanges(ms, { HEALTH: 5 as never })).toEqual([]);
    expect(applySubDecisionChanges(ms, { HEALTH: null as never })).toEqual([]);
  });
});

describe("las sub-decisiones iniciales son válidas", () => {
  it("cada valor sembrado en generateMinistries existe en los specs y está en rango", () => {
    for (const m of generateMinistries()) {
      for (const [key, value] of Object.entries(m.subDecisions)) {
        const check = validateSubDecision(m.key, key, value);
        expect(check.ok, `${m.key}.${key}`).toBe(true);
        if (check.ok) expect(check.value, `${m.key}.${key}`).toBe(value);
      }
    }
  });
});

describe("la UI y el motor coinciden", () => {
  const src = readFileSync(resolve(process.cwd(), "src/components/game/sub-decisions.tsx"), "utf8");
  const MINISTRY_OF: Record<string, string> = {
    HealthDecisions: "HEALTH", EducationDecisions: "EDUCATION", EconomyDecisions: "ECONOMY",
    DefenseDecisions: "DEFENSE", SecurityDecisions: "SECURITY", JusticeDecisions: "JUSTICE",
    AgricultureDecisions: "AGRICULTURE", SocialDevelopmentDecisions: "SOCIAL_DEVELOPMENT",
  };

  // Controles de la UI: { ministerio.clave → { tipo, min, max, step, derivado } }
  const ui = new Map<string, { kind: string; min?: number; max?: number; step?: number; derived: boolean }>();
  const parts = src.split(/\nfunction (\w+)\(/);
  for (let i = 1; i < parts.length; i += 2) {
    const ministry = MINISTRY_OF[parts[i]];
    if (!ministry) continue;
    for (const m of parts[i + 1].matchAll(/<(SliderControl|ToggleControl|NumberInputControl)\b([\s\S]*?)\/>/g)) {
      const key = m[2].match(/onChange\("(\w+)"/)?.[1];
      if (!key) continue;
      const num = (name: string) => m[2].match(new RegExp(`${name}=\\{(-?[\\d.]+)\\}`))?.[1];
      ui.set(`${ministry}.${key}`, {
        kind: m[1],
        min: num("min") === undefined ? undefined : Number(num("min")),
        max: num("max") === undefined ? undefined : Number(num("max")),
        step: num("step") === undefined ? undefined : Number(num("step")),
        derived: m[2].includes("numberRange("),
      });
    }
  }

  it("el parser encontró los controles de la UI", () => {
    expect(ui.size).toBeGreaterThanOrEqual(20);
  });

  it("toda decisión de la UI existe en los specs con el mismo tipo y rango", () => {
    for (const [id, control] of ui) {
      const [ministry, key] = id.split(".");
      const spec = SUB_DECISION_SPECS[ministry]?.[key];
      expect(spec, `${id} no está en SUB_DECISION_SPECS`).toBeDefined();
      if (control.kind === "ToggleControl") {
        expect(spec.type, id).toBe("boolean");
      } else {
        expect(spec.type, id).toBe("number");
        if (spec.type === "number" && !control.derived) {
          expect(control.min, `${id} min`).toBe(spec.min);
          expect(control.max, `${id} max`).toBe(spec.max);
          expect(control.step ?? 1, `${id} step`).toBe(spec.step ?? 1);
        }
      }
    }
  });

  it("toda decisión de los specs tiene su control en la UI", () => {
    for (const [ministry, specs] of Object.entries(SUB_DECISION_SPECS)) {
      for (const key of Object.keys(specs)) expect(ui.has(`${ministry}.${key}`), `${ministry}.${key}`).toBe(true);
    }
  });

  it("los numéricos sin tope en la UI toman su rango del motor", () => {
    for (const id of ["ECONOMY.salarioMinimo", "DEFENSE.tropasActivas", "JUSTICE.juecesContratados"]) {
      expect(ui.get(id)?.derived, id).toBe(true);
      const [ministry, key] = id.split(".");
      expect(numberRange(ministry, key).max).toBeGreaterThan(0);
    }
  });
});
