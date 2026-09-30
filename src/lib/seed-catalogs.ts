// ─── Catálogos de siembra por partida ────────────────────────────────────────
// Única fuente de verdad de las entidades que se crean con cada partida nueva
// y que `ensureSeedIntegrity` repone en partidas existentes. Solo datos:
// sin Prisma ni lógica, para poder importarlo desde el motor y los tests.

import type { TradeGoodCategory } from "./engine/types";

export type DiseaseCategory = "TRANSMISSIBLE" | "CHRONIC" | "MENTAL_HEALTH";

export interface DiseaseSeed {
  name: string;
  category: DiseaseCategory;
  contagionRate: number;
  mortalityRate: number;
  prevalenceBase: number;
  hasVaccine: boolean;
  preventionSensitivity: number;
  monthlyCostPerPatient: number;
  classAffinity: {
    EXTREME_POVERTY: number;
    POVERTY: number;
    MIDDLE: number;
    ELITE: number;
  };
}

export const DISEASE_CATALOG: readonly DiseaseSeed[] = [
  { name: "Gripe estacional", category: "TRANSMISSIBLE", contagionRate: 0.15, mortalityRate: 0.001, prevalenceBase: 10, hasVaccine: true, preventionSensitivity: 0.8, monthlyCostPerPatient: 200, classAffinity: { EXTREME_POVERTY: 1.0, POVERTY: 1.0, MIDDLE: 1.0, ELITE: 1.0 } },
  { name: "Dengue", category: "TRANSMISSIBLE", contagionRate: 0.08, mortalityRate: 0.005, prevalenceBase: 5, hasVaccine: false, preventionSensitivity: 0.6, monthlyCostPerPatient: 500, classAffinity: { EXTREME_POVERTY: 1.5, POVERTY: 1.3, MIDDLE: 0.7, ELITE: 0.5 } },
  { name: "Tuberculosis", category: "TRANSMISSIBLE", contagionRate: 0.03, mortalityRate: 0.02, prevalenceBase: 3, hasVaccine: true, preventionSensitivity: 0.5, monthlyCostPerPatient: 1200, classAffinity: { EXTREME_POVERTY: 2.0, POVERTY: 1.5, MIDDLE: 0.5, ELITE: 0.2 } },
  { name: "VIH", category: "TRANSMISSIBLE", contagionRate: 0.01, mortalityRate: 0.05, prevalenceBase: 2, hasVaccine: false, preventionSensitivity: 0.7, monthlyCostPerPatient: 3000, classAffinity: { EXTREME_POVERTY: 1.0, POVERTY: 1.0, MIDDLE: 1.0, ELITE: 1.0 } },
  { name: "COVID-X", category: "TRANSMISSIBLE", contagionRate: 0.20, mortalityRate: 0.015, prevalenceBase: 1, hasVaccine: true, preventionSensitivity: 0.9, monthlyCostPerPatient: 1500, classAffinity: { EXTREME_POVERTY: 1.0, POVERTY: 1.0, MIDDLE: 1.0, ELITE: 1.2 } },
  { name: "Parasitos", category: "TRANSMISSIBLE", contagionRate: 0.06, mortalityRate: 0.002, prevalenceBase: 8, hasVaccine: false, preventionSensitivity: 0.4, monthlyCostPerPatient: 300, classAffinity: { EXTREME_POVERTY: 2.5, POVERTY: 1.8, MIDDLE: 0.5, ELITE: 0.1 } },
  { name: "Neumonia", category: "TRANSMISSIBLE", contagionRate: 0.04, mortalityRate: 0.03, prevalenceBase: 4, hasVaccine: true, preventionSensitivity: 0.6, monthlyCostPerPatient: 2000, classAffinity: { EXTREME_POVERTY: 1.3, POVERTY: 1.2, MIDDLE: 0.8, ELITE: 0.7 } },
  { name: "Diabetes", category: "CHRONIC", contagionRate: 0, mortalityRate: 0.01, prevalenceBase: 8, hasVaccine: false, preventionSensitivity: 0.5, monthlyCostPerPatient: 800, classAffinity: { EXTREME_POVERTY: 0.7, POVERTY: 0.8, MIDDLE: 1.3, ELITE: 1.2 } },
  { name: "Hipertension", category: "CHRONIC", contagionRate: 0, mortalityRate: 0.008, prevalenceBase: 14, hasVaccine: false, preventionSensitivity: 0.5, monthlyCostPerPatient: 600, classAffinity: { EXTREME_POVERTY: 0.6, POVERTY: 0.8, MIDDLE: 1.2, ELITE: 1.3 } },
  { name: "Cancer", category: "CHRONIC", contagionRate: 0, mortalityRate: 0.04, prevalenceBase: 2.5, hasVaccine: false, preventionSensitivity: 0.3, monthlyCostPerPatient: 5000, classAffinity: { EXTREME_POVERTY: 0.8, POVERTY: 0.9, MIDDLE: 1.0, ELITE: 1.1 } },
  { name: "EPOC", category: "CHRONIC", contagionRate: 0, mortalityRate: 0.02, prevalenceBase: 4, hasVaccine: false, preventionSensitivity: 0.3, monthlyCostPerPatient: 1000, classAffinity: { EXTREME_POVERTY: 1.0, POVERTY: 1.0, MIDDLE: 1.0, ELITE: 1.0 } },
  { name: "Depresion", category: "MENTAL_HEALTH", contagionRate: 0, mortalityRate: 0.001, prevalenceBase: 12, hasVaccine: false, preventionSensitivity: 0.5, monthlyCostPerPatient: 400, classAffinity: { EXTREME_POVERTY: 0.8, POVERTY: 0.9, MIDDLE: 1.3, ELITE: 1.0 } },
  { name: "Ansiedad", category: "MENTAL_HEALTH", contagionRate: 0, mortalityRate: 0.001, prevalenceBase: 10, hasVaccine: false, preventionSensitivity: 0.5, monthlyCostPerPatient: 350, classAffinity: { EXTREME_POVERTY: 0.8, POVERTY: 0.9, MIDDLE: 1.3, ELITE: 1.0 } },
  { name: "Adicciones", category: "MENTAL_HEALTH", contagionRate: 0, mortalityRate: 0.005, prevalenceBase: 5, hasVaccine: false, preventionSensitivity: 0.4, monthlyCostPerPatient: 900, classAffinity: { EXTREME_POVERTY: 1.4, POVERTY: 1.3, MIDDLE: 0.8, ELITE: 0.7 } },
];

export interface TradeGoodSeed {
  key: string;
  category: TradeGoodCategory;
  name: string;
  description: string;
  baseCostPerUnit: number;
  unitDescription: string;
  demandPerCapita: number;
  /** Fracción de la demanda que cubre el flujo de importación inicial (mix por defecto). */
  defaultFlowShare: number;
}

export const TRADE_GOOD_CATALOG: readonly TradeGoodSeed[] = [
  {
    key: "medicamentos_genericos",
    category: "MEDICAMENTS_GENERIC",
    name: "Medicamentos genéricos",
    description: "Medicamentos esenciales de bajo costo para cobertura basica",
    baseCostPerUnit: 50,
    unitDescription: "Tratamiento mensual para 100 personas",
    demandPerCapita: 0.00001,
    defaultFlowShare: 0.7,
  },
  {
    key: "medicamentos_marca",
    category: "MEDICAMENTS_BRAND",
    name: "Medicamentos de marca",
    description: "Farmacos de patente con mayor efectividad y menor mortalidad",
    baseCostPerUnit: 200,
    unitDescription: "Tratamiento mensual para 100 personas",
    demandPerCapita: 0.00001,
    defaultFlowShare: 0.3,
  },
];
