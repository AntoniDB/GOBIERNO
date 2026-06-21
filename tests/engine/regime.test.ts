import { describe, it, expect } from "vitest";
import type { RegimeMetricsState } from "@/lib/engine/types";
import { classifyRegime } from "@/lib/engine/regime";

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
