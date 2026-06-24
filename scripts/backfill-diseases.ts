// ─── Backfill: sembrar enfermedades para partidas existentes ──────────────
// Uso: node --import tsx scripts/backfill-diseases.ts
// Requiere DATABASE_URL en el entorno.
// Solo ejecuta para partidas sin enfermedades (idempotente).

import { config } from "dotenv";
import { resolve } from "path";

// Cargar .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DISEASES = [
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

async function main() {
  const games = await prisma.game.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, countryName: true },
  });

  for (const game of games) {
    const existing = await prisma.disease.count({ where: { gameId: game.id } });
    if (existing >= 14) {
      console.log(`  ✓ ${game.countryName}: ya tiene ${existing} enfermedades`);
      continue;
    }

    console.log(`  ⟳ ${game.countryName}: sembrando ${DISEASES.length} enfermedades...`);
    for (const d of DISEASES) {
      const disease = await prisma.disease.create({
        data: {
          game: { connect: { id: game.id } },
          name: d.name,
          category: d.category,
          contagionRate: d.contagionRate,
          mortalityRate: d.mortalityRate,
          prevalence: 0,
          prevalenceBase: d.prevalenceBase,
          hasVaccine: d.hasVaccine,
          preventionSensitivity: d.preventionSensitivity,
          monthlyCostPerPatient: d.monthlyCostPerPatient,
          classAffinity: d.classAffinity,
        },
      });
      await prisma.diseasePrevalence.create({
        data: {
          game: { connect: { id: game.id } },
          disease: { connect: { id: disease.id } },
          currentPrevalence: 0,
        },
      });
    }
    console.log(`  ✓ ${game.countryName}: ${DISEASES.length} enfermedades sembradas`);
  }

  console.log("\n✅ Backfill completado.");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
