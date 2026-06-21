import { describe, it, expect } from "vitest";
import type { RegimeMetricsState, ActiveLawState, OrganismState } from "@/lib/engine/types";
import { classifyRegime, calculateRegimeMetrics, regenerateRegimeMetrics } from "@/lib/engine/regime";

function crearMetricas(overrides?: Partial<RegimeMetricsState>): RegimeMetricsState {
  return {
    powerConcentration: 30,
    pressFreedom: 80,
    judicialIndependence: 80,
    politicalPluralism: 80,
    civilLiberties: 80,
    transparency: 75,
    militarySubordination: 85,
    ...overrides,
  };
}

describe("classifyRegime", () => {
  it('devuelve "Democracia plena" para métricas altas', () => {
    const metrics = crearMetricas({
      pressFreedom: 85,
      judicialIndependence: 85,
      politicalPluralism: 85,
      powerConcentration: 10,
      civilLiberties: 80,
      transparency: 80,
      militarySubordination: 90,
    });
    expect(classifyRegime(metrics)).toBe("Democracia plena");
  });

  it('devuelve "Dictadura" para métricas bajas + alta concentración de poder', () => {
    const metrics = crearMetricas({
      powerConcentration: 90,
      pressFreedom: 5,
      judicialIndependence: 5,
      politicalPluralism: 5,
      civilLiberties: 5,
      transparency: 5,
      militarySubordination: 5,
    });
    expect(classifyRegime(metrics)).toBe("Dictadura");
  });

  it('devuelve "Estado fallido" con crimen, corrupción altos y aprobación baja', () => {
    const metrics = crearMetricas({
      powerConcentration: 50,
      pressFreedom: 30,
      judicialIndependence: 30,
      politicalPluralism: 30,
      civilLiberties: 30,
      transparency: 30,
      militarySubordination: 40,
    });
    expect(classifyRegime(metrics, 90, 90, 5)).toBe("Estado fallido");
  });

  it('devuelve "Democracia defectuosa" para métricas moderadas', () => {
    const metrics = crearMetricas({
      pressFreedom: 65,
      judicialIndependence: 65,
      politicalPluralism: 65,
      powerConcentration: 25,
      civilLiberties: 60,
      transparency: 60,
      militarySubordination: 60,
    });
    // promedio ≈ 61.4 > 55 (REGIME_DEFECTIVE_DEMOCRACY)
    expect(classifyRegime(metrics)).toBe("Democracia defectuosa");
  });

  it('devuelve "Régimen híbrido" para métricas bajas pero no dictadura', () => {
    const metrics = crearMetricas({
      powerConcentration: 60,
      pressFreedom: 40,
      judicialIndependence: 40,
      politicalPluralism: 40,
      civilLiberties: 40,
      transparency: 40,
      militarySubordination: 40,
    });
    // promedio = (60+40+40+40+40+40+40)/7 ≈ 42.85 > 35
    expect(classifyRegime(metrics)).toBe("Régimen híbrido");
  });

  it('devuelve "Autoritarismo electoral" para métricas entre 20 y 35', () => {
    const metrics = crearMetricas({
      powerConcentration: 70,
      pressFreedom: 25,
      judicialIndependence: 25,
      politicalPluralism: 25,
      civilLiberties: 25,
      transparency: 25,
      militarySubordination: 25,
    });
    // promedio ≈ 31.4 > 20
    expect(classifyRegime(metrics)).toBe("Autoritarismo electoral");
  });
});

describe("calculateRegimeMetrics con leyes", () => {
  it("ley de transparencia suma +20 a transparencia", () => {
    const metrics = crearMetricas({ transparency: 50 });
    const activeLaws: ActiveLawState[] = [
      {
        id: "law-1",
        lawKey: "ley-transparencia",
        activatedAt: "2024-01-01",
        effectsJson: { transparency: 20, corruption: -8 },
      },
    ];
    const result = calculateRegimeMetrics(metrics, {}, activeLaws, [], []);
    // 50 + 20 = 70, clamp a 100
    expect(result.transparency).toBe(70);
  });

  it("ley de censura reduce libertad de prensa", () => {
    const metrics = crearMetricas({ pressFreedom: 80 });
    const activeLaws: ActiveLawState[] = [
      {
        id: "law-2",
        lawKey: "censura-medios",
        activatedAt: "2024-01-01",
        effectsJson: { pressFreedom: -20, powerConcentration: 10 },
      },
    ];
    const result = calculateRegimeMetrics(metrics, {}, activeLaws, [], []);
    expect(result.pressFreedom).toBe(60);
    expect(result.powerConcentration).toBe(40); // 30 + 10
  });

  it("Contraloría autónoma mejora transparencia e independencia judicial", () => {
    const metrics = crearMetricas({ transparency: 40, judicialIndependence: 50 });
    const organisms: OrganismState[] = [
      {
        id: "org-1", type: "COMPTROLLER", name: "Contraloría",
        monthlyBudget: 150, staff: 30, effectiveness: 60,
        autonomyLevel: 80, headOfficialId: null,
      },
    ];
    const result = calculateRegimeMetrics(metrics, {}, [], organisms, []);
    // transparency: 40 + 15 = 55, judicialIndependence: 50 + 5 = 55
    expect(result.transparency).toBe(55);
    expect(result.judicialIndependence).toBe(55);
  });

  it("Contraloría no autónoma no da bonus", () => {
    const metrics = crearMetricas({ transparency: 40, judicialIndependence: 50 });
    const organisms: OrganismState[] = [
      {
        id: "org-1", type: "COMPTROLLER", name: "Contraloría",
        monthlyBudget: 150, staff: 30, effectiveness: 60,
        autonomyLevel: 40, headOfficialId: null,
      },
    ];
    const result = calculateRegimeMetrics(metrics, {}, [], organisms, []);
    expect(result.transparency).toBe(40);
    expect(result.judicialIndependence).toBe(50);
  });
});

describe("regenerateRegimeMetrics", () => {
  it("métricas por debajo del baseline suben 0.5 si no fueron modificadas", () => {
    const before = crearMetricas({ pressFreedom: 50 });
    const after = { ...before };
    // Sin cambios → regeneración aplicada
    const result = regenerateRegimeMetrics(after, before);
    // baseline pressFreedom = 70, actual = 50 → sube a 50.5
    expect(result.pressFreedom).toBe(50.5);
  });

  it("métricas por encima del baseline bajan 0.5 si no fueron modificadas", () => {
    const before = crearMetricas({ powerConcentration: 50 });
    const after = { ...before };
    const result = regenerateRegimeMetrics(after, before);
    // baseline powerConcentration = 30, actual = 50 → baja a 49.5
    expect(result.powerConcentration).toBe(49.5);
  });

  it("métricas modificadas no reciben regeneración", () => {
    const before = crearMetricas({ pressFreedom: 50 });
    const after = { ...before, pressFreedom: 55 }; // +5 por acción
    const result = regenerateRegimeMetrics(after, before);
    // Fue modificada → no se regenera, queda en 55
    expect(result.pressFreedom).toBe(55);
  });
});
