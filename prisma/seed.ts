// @ts-nocheck — Seed script: mapeo entre datos de prueba y Prisma 7.
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─── Datos semilla ────────────────────────────────────────────────────────────

const NOMBRES = [
  "Alejandro", "Beatriz", "Carlos", "Dolores", "Enrique", "Francisca", "Gabriel",
  "Helena", "Ignacio", "Jimena", "Lorenzo", "Marina", "Nicolás", "Ofelia", "Pedro",
  "Renata", "Santiago", "Teresa", "Ulises", "Valentina", "Xavier", "Yolanda",
  "Andrés", "Camila", "Diego", "Elena", "Felipe", "Gloria", "Hugo", "Isabel",
];

const APELLIDOS = [
  "García", "Martínez", "López", "Hernández", "González", "Rodríguez", "Pérez",
  "Sánchez", "Ramírez", "Cruz", "Flores", "Morales", "Ortiz", "Reyes", "Vargas",
  "Castro", "Mendoza", "Romero", "Torres", "Herrera", "Medina", "Aguilar",
  "Silva", "Rojas", "Moreno", "Vega", "Delgado", "Campos", "Paredes", "Fuentes",
];

function nombreAleatorio(i: number): string {
  return `${NOMBRES[i % NOMBRES.length]} ${APELLIDOS[(i * 3) % APELLIDOS.length]} ${APELLIDOS[(i * 7 + 5) % APELLIDOS.length]}`;
}

// ─── Función principal ────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Iniciando seed...");

  // Limpiar datos existentes en orden (respetando FK)
  await prisma.mediaCoverage.deleteMany();
  await prisma.investigation.deleteMany();
  await prisma.judicialCase.deleteMany();
  await prisma.lawProposal.deleteMany();
  await prisma.activeLaw.deleteMany();
  await prisma.ministryDecision.deleteMany();
  await prisma.senator.deleteMany();
  await prisma.organism.deleteMany();
  await prisma.media.deleteMany();
  await prisma.event.deleteMany();
  await prisma.socialClass.deleteMany();
  await prisma.regimeMetrics.deleteMany();
  await prisma.ministry.deleteMany();
  await prisma.party.deleteMany();
  await prisma.official.deleteMany();
  await prisma.country.deleteMany();
  await prisma.treaty.deleteMany();
  await prisma.disease.deleteMany();
  await prisma.infrastructure.deleteMany();
  await prisma.region.deleteMany();
  await prisma.monthSnapshot.deleteMany();
  await prisma.lawCatalog.deleteMany();
  await prisma.game.deleteMany();
  await prisma.user.deleteMany();

  // ─── Usuario demo ─────────────────────────────────────────────────────────

  const passwordHash = await bcrypt.hash("demo123", 10);
  const user = await prisma.user.create({
    data: {
      email: "demo@simulador.local",
      passwordHash,
    },
  });
  console.log("  ✓ Usuario demo creado");

  // ─── Partida demo ─────────────────────────────────────────────────────────

  const game = await prisma.game.create({
    data: {
      userId: user.id,
      countryName: "República Demo",
      currentYear: 1,
      currentMonth: 0,
      status: "ACTIVE",
      seed: "demo-seed-42",
      preset: "estable_democratico",
      difficulty: "normal",
    },
  });
  console.log("  ✓ Partida demo creada");

  // ─── Partidos políticos (5) ───────────────────────────────────────────────

  const partidos = await Promise.all([
    prisma.party.create({
      data: {
        gameId: game.id,
        name: "Partido Conservador Nacional",
        ideology: { economic: 70, social: -50, authority: 40 },
        popularity: 22,
        seatsLower: 60,
        seatsUpper: 8,
      },
    }),
    prisma.party.create({
      data: {
        gameId: game.id,
        name: "Alianza Progresista",
        ideology: { economic: -40, social: 60, authority: -30 },
        popularity: 28,
        seatsLower: 80,
        seatsUpper: 10,
      },
    }),
    prisma.party.create({
      data: {
        gameId: game.id,
        name: "Unión Democrática Social",
        ideology: { economic: 10, social: 20, authority: -10 },
        popularity: 20,
        seatsLower: 50,
        seatsUpper: 6,
      },
    }),
    prisma.party.create({
      data: {
        gameId: game.id,
        name: "Movimiento Obrero Popular",
        ideology: { economic: -80, social: 40, authority: -50 },
        popularity: 15,
        seatsLower: 35,
        seatsUpper: 4,
      },
    }),
    prisma.party.create({
      data: {
        gameId: game.id,
        name: "Frente Liberal Republicano",
        ideology: { economic: 60, social: -10, authority: -60 },
        popularity: 15,
        seatsLower: 35,
        seatsUpper: 4,
      },
    }),
  ]);
  console.log("  ✓ 5 partidos creados");

  // ─── Funcionarios (ministros + extras) ────────────────────────────────────

  const oficiales = await Promise.all([
    // 8 ministros
    prisma.official.create({
      data: {
        gameId: game.id, name: nombreAleatorio(0), role: "MINISTER",
        ideology: { economic: -20, social: 30, authority: -20 },
        loyalty: 65, ambition: 25, wealth: 150000, corruption: 8, skill: 72, reputation: 60,
      },
    }),
    prisma.official.create({
      data: {
        gameId: game.id, name: nombreAleatorio(1), role: "MINISTER",
        ideology: { economic: 10, social: 40, authority: -10 },
        loyalty: 70, ambition: 20, wealth: 120000, corruption: 5, skill: 78, reputation: 65,
      },
    }),
    prisma.official.create({
      data: {
        gameId: game.id, name: nombreAleatorio(2), role: "MINISTER",
        ideology: { economic: 50, social: -20, authority: 10 },
        loyalty: 55, ambition: 40, wealth: 200000, corruption: 15, skill: 68, reputation: 55,
      },
    }),
    prisma.official.create({
      data: {
        gameId: game.id, name: nombreAleatorio(3), role: "MINISTER",
        ideology: { economic: 30, social: -10, authority: 40 },
        loyalty: 80, ambition: 30, wealth: 180000, corruption: 10, skill: 75, reputation: 58,
      },
    }),
    prisma.official.create({
      data: {
        gameId: game.id, name: nombreAleatorio(4), role: "MINISTER",
        ideology: { economic: -10, social: -20, authority: 30 },
        loyalty: 60, ambition: 35, wealth: 130000, corruption: 12, skill: 65, reputation: 52,
      },
    }),
    prisma.official.create({
      data: {
        gameId: game.id, name: nombreAleatorio(5), role: "MINISTER",
        ideology: { economic: -30, social: 50, authority: -40 },
        loyalty: 50, ambition: 45, wealth: 90000, corruption: 6, skill: 80, reputation: 70,
      },
    }),
    prisma.official.create({
      data: {
        gameId: game.id, name: nombreAleatorio(6), role: "MINISTER",
        ideology: { economic: -60, social: 30, authority: -20 },
        loyalty: 45, ambition: 30, wealth: 70000, corruption: 4, skill: 70, reputation: 62,
      },
    }),
    prisma.official.create({
      data: {
        gameId: game.id, name: nombreAleatorio(7), role: "MINISTER",
        ideology: { economic: 20, social: 10, authority: 0 },
        loyalty: 75, ambition: 15, wealth: 160000, corruption: 9, skill: 60, reputation: 55,
      },
    }),
    // 3 jueces
    prisma.official.create({
      data: { gameId: game.id, name: nombreAleatorio(10), role: "JUDGE",
        ideology: { economic: 0, social: 0, authority: 0 }, loyalty: 50, ambition: 20,
        wealth: 80000, corruption: 5, skill: 75, reputation: 68,
      },
    }),
    prisma.official.create({
      data: { gameId: game.id, name: nombreAleatorio(11), role: "JUDGE",
        ideology: { economic: 10, social: -10, authority: 20 }, loyalty: 40, ambition: 30,
        wealth: 95000, corruption: 12, skill: 60, reputation: 50,
      },
    }),
    prisma.official.create({
      data: { gameId: game.id, name: nombreAleatorio(12), role: "JUDGE",
        ideology: { economic: -10, social: 30, authority: -30 }, loyalty: 55, ambition: 25,
        wealth: 75000, corruption: 3, skill: 82, reputation: 72,
      },
    }),
    // 3 fiscales
    prisma.official.create({
      data: { gameId: game.id, name: nombreAleatorio(13), role: "PROSECUTOR",
        ideology: { economic: -20, social: 20, authority: -10 }, loyalty: 45, ambition: 35,
        wealth: 70000, corruption: 4, skill: 78, reputation: 65,
      },
    }),
    prisma.official.create({
      data: { gameId: game.id, name: nombreAleatorio(14), role: "PROSECUTOR",
        ideology: { economic: 0, social: 0, authority: 10 }, loyalty: 50, ambition: 30,
        wealth: 65000, corruption: 8, skill: 70, reputation: 58,
      },
    }),
    prisma.official.create({
      data: { gameId: game.id, name: nombreAleatorio(15), role: "PROSECUTOR",
        ideology: { economic: 10, social: -20, authority: 20 }, loyalty: 35, ambition: 50,
        wealth: 85000, corruption: 18, skill: 55, reputation: 40,
      },
    }),
    // 1 general
    prisma.official.create({
      data: { gameId: game.id, name: nombreAleatorio(16), role: "GENERAL",
        ideology: { economic: 40, social: -40, authority: 60 }, loyalty: 70, ambition: 40,
        wealth: 250000, corruption: 15, skill: 70, reputation: 50,
      },
    }),
  ]);
  console.log("  ✓ 16 funcionarios creados");

  // ─── Asignar líderes a partidos ──────────────────────────────────────────

  // Crear líderes de partido (no ministros, para evitar conflicto de rol)
  const lideresRaw = await Promise.all([
    prisma.official.create({ data: { gameId: game.id, name: nombreAleatorio(20), role: "MINISTER", partyId: partidos[0].id, ideology: partidos[0].ideology as object, loyalty: 90, ambition: 50, wealth: 300000, corruption: 10, skill: 70, reputation: 55 } }),
    prisma.official.create({ data: { gameId: game.id, name: nombreAleatorio(21), role: "MINISTER", partyId: partidos[1].id, ideology: partidos[1].ideology as object, loyalty: 85, ambition: 45, wealth: 250000, corruption: 6, skill: 75, reputation: 62 } }),
    prisma.official.create({ data: { gameId: game.id, name: nombreAleatorio(22), role: "MINISTER", partyId: partidos[2].id, ideology: partidos[2].ideology as object, loyalty: 80, ambition: 35, wealth: 200000, corruption: 8, skill: 68, reputation: 58 } }),
    prisma.official.create({ data: { gameId: game.id, name: nombreAleatorio(23), role: "MINISTER", partyId: partidos[3].id, ideology: partidos[3].ideology as object, loyalty: 75, ambition: 55, wealth: 120000, corruption: 5, skill: 72, reputation: 60 } }),
    prisma.official.create({ data: { gameId: game.id, name: nombreAleatorio(24), role: "MINISTER", partyId: partidos[4].id, ideology: partidos[4].ideology as object, loyalty: 82, ambition: 40, wealth: 280000, corruption: 7, skill: 65, reputation: 54 } }),
  ]);

  // Actualizar partidos con líderes
  for (let i = 0; i < 5; i++) {
    await prisma.party.update({
      where: { id: partidos[i].id },
      data: { leaderOfficialId: lideresRaw[i].id },
    });
  }
  console.log("  ✓ Líderes de partido asignados");

  // ─── Ministerios (8 prioritarios) ─────────────────────────────────────────

  const ministeriosData = [
    { key: "HEALTH" as const, ministerId: oficiales[0].id, budget: 14, subDecisions: { hospitalesPublicos: 60, vacunacion: true, saludMental: false } },
    { key: "EDUCATION" as const, ministerId: oficiales[1].id, budget: 16, subDecisions: { primaria: 40, secundaria: 35, superior: 25, enfoqueSTEM: 60, becas: true } },
    { key: "ECONOMY" as const, ministerId: oficiales[2].id, budget: 18, subDecisions: { tasaInteres: 4.5, salarioMinimo: 350, politicaIndustrial: 50 } },
    { key: "DEFENSE" as const, ministerId: oficiales[3].id, budget: 10, subDecisions: { tropasActivas: 50000, gastoEquipamiento: 40, servicioMilitar: false } },
    { key: "SECURITY" as const, ministerId: oficiales[4].id, budget: 12, subDecisions: { patrullajeUrbano: 60, politicaDrogas: 50, inversionCarceles: 30 } },
    { key: "JUSTICE" as const, ministerId: oficiales[5].id, budget: 8, subDecisions: { juecesContratados: 200, prioridadCorrupcion: 60, durezaPenal: 50 } },
    { key: "AGRICULTURE" as const, ministerId: oficiales[6].id, budget: 10, subDecisions: { subsidioPequenoProductor: 70, infraestructuraRural: 40 } },
    { key: "SOCIAL_DEVELOPMENT" as const, ministerId: oficiales[7].id, budget: 12, subDecisions: { focalizacion: 60, prioridadNinos: 40, prioridadAdultosMayores: 35, prioridadMujeres: 25 } },
  ];

  for (const m of ministeriosData) {
    await prisma.ministry.create({
      data: {
        gameId: game.id,
        key: m.key,
        budgetPercent: m.budget,
        ministerOfficialId: m.ministerId,
        subDecisions: m.subDecisions,
        efficiency: 55,
        internalCorruption: 10,
      },
    });
  }
  console.log("  ✓ 8 ministerios creados");

  // ─── Senadores (20: 15 cámara baja, 5 alta) ──────────────────────────────

  const distribucionEscaños = [5, 6, 3, 2, 2]; // baja
  const distribucionAlta = [2, 2, 1, 0, 0];    // alta
  let senIdx = 0;

  for (let p = 0; p < 5; p++) {
    for (let s = 0; s < distribucionEscaños[p]; s++) {
      await prisma.senator.create({
        data: {
          gameId: game.id,
          partyId: partidos[p].id,
          name: nombreAleatorio(30 + senIdx),
          personalIdeology: partidos[p].ideology as object,
          chamber: "LOWER",
          loyalty: 50 + Math.floor(Math.random() * 40),
        },
      });
      senIdx++;
    }
    for (let s = 0; s < distribucionAlta[p]; s++) {
      await prisma.senator.create({
        data: {
          gameId: game.id,
          partyId: partidos[p].id,
          name: nombreAleatorio(50 + senIdx),
          personalIdeology: partidos[p].ideology as object,
          chamber: "UPPER",
          loyalty: 55 + Math.floor(Math.random() * 35),
        },
      });
      senIdx++;
    }
  }
  console.log("  ✓ 20 senadores creados");

  // ─── Catálogo de leyes (15+) ──────────────────────────────────────────────

  const leyes = [
    { key: "subsidio-alimentario", name: "Subsidio Alimentario", description: "Programa de subsidio directo para alimentos básicos a familias de bajos recursos.", effectsJson: { povertyRate: -5, approval: { EXTREME_POVERTY: 8, POVERTY: 4, MIDDLE: -1, ELITE: -2 } }, idealIdeology: { economic: -60, social: 40, authority: -10 }, cost: 500000000 },
    { key: "impuesto-progresivo", name: "Impuesto Progresivo a la Renta", description: "Sistema impositivo donde los que más ganan pagan mayor porcentaje.", effectsJson: { taxRevenue: 15, approval: { EXTREME_POVERTY: 5, POVERTY: 3, MIDDLE: 0, ELITE: -8 }, gini: -3 }, idealIdeology: { economic: -70, social: 30, authority: 0 }, cost: 0 },
    { key: "ley-anticorrupcion", name: "Ley Anticorrupción Integral", description: "Endurece penas por corrupción y crea mecanismos de control.", effectsJson: { corruption: -10, transparency: 15, approval: { EXTREME_POVERTY: 3, POVERTY: 3, MIDDLE: 5, ELITE: -2 } }, idealIdeology: { economic: 0, social: 30, authority: 0 }, cost: 200000000 },
    { key: "servicio-militar-obligatorio", name: "Servicio Militar Obligatorio", description: "Establece el servicio militar obligatorio para jóvenes de 18 años.", effectsJson: { defenseEfficiency: 10, approval: { EXTREME_POVERTY: -2, POVERTY: -5, MIDDLE: -3, ELITE: 2 }, civilLiberties: -5 }, idealIdeology: { economic: 20, social: -30, authority: 50 }, cost: 300000000 },
    { key: "educacion-publica-gratuita", name: "Educación Pública Gratuita Universal", description: "Garantiza acceso gratuito a todos los niveles educativos.", effectsJson: { educationLevel: 15, approval: { EXTREME_POVERTY: 8, POVERTY: 7, MIDDLE: 5, ELITE: -1 } }, idealIdeology: { economic: -30, social: 60, authority: 0 }, cost: 800000000 },
    { key: "salud-universal", name: "Sistema de Salud Universal", description: "Cobertura médica garantizada para todos los ciudadanos.", effectsJson: { sickRate: -8, approval: { EXTREME_POVERTY: 10, POVERTY: 8, MIDDLE: 6, ELITE: -1 } }, idealIdeology: { economic: -40, social: 50, authority: 0 }, cost: 1000000000 },
    { key: "liberalizacion-economica", name: "Liberalización Económica", description: "Reduce regulaciones, aranceles y barreras comerciales.", effectsJson: { gdp: 10, taxRevenue: -5, approval: { EXTREME_POVERTY: -5, POVERTY: -3, MIDDLE: 2, ELITE: 8 }, gini: 5 }, idealIdeology: { economic: 80, social: -20, authority: -30 }, cost: 0 },
    { key: "estado-emergencia", name: "Estado de Emergencia Nacional", description: "Otorga poderes especiales al ejecutivo para manejar crisis.", effectsJson: { civilLiberties: -15, powerConcentration: 10, approval: { EXTREME_POVERTY: 0, POVERTY: -2, MIDDLE: -5, ELITE: 5 } }, idealIdeology: { economic: 30, social: -40, authority: 80 }, cost: 100000000 },
    { key: "reforma-judicial", name: "Reforma del Poder Judicial", description: "Reestructura el sistema judicial para mayor independencia.", effectsJson: { judicialIndependence: 20, corruption: -5, approval: { EXTREME_POVERTY: 2, POVERTY: 3, MIDDLE: 5, ELITE: 0 } }, idealIdeology: { economic: 0, social: 40, authority: -20 }, cost: 400000000 },
    { key: "ley-transparencia", name: "Ley de Transparencia y Acceso a la Información", description: "Obliga al gobierno a publicar todos sus actos y gastos.", effectsJson: { transparency: 20, corruption: -8, approval: { EXTREME_POVERTY: 2, POVERTY: 3, MIDDLE: 6, ELITE: 2 } }, idealIdeology: { economic: -10, social: 50, authority: -30 }, cost: 100000000 },
    { key: "libertad-prensa", name: "Libertad de Prensa Garantizada", description: "Prohíbe la censura estatal y protege a periodistas.", effectsJson: { pressFreedom: 25, approval: { EXTREME_POVERTY: 1, POVERTY: 3, MIDDLE: 7, ELITE: 4 } }, idealIdeology: { economic: -20, social: 70, authority: -50 }, cost: 50000000 },
    { key: "censura-medios", name: "Ley de Regulación de Contenidos Mediáticos", description: "Permite al gobierno controlar contenidos 'perjudiciales' en medios.", effectsJson: { pressFreedom: -20, powerConcentration: 10, approval: { EXTREME_POVERTY: -1, POVERTY: -3, MIDDLE: -8, ELITE: 2 } }, idealIdeology: { economic: 30, social: -60, authority: 70 }, cost: 50000000 },
    { key: "reforma-constitucional", name: "Reforma Constitucional", description: "Modifica artículos clave de la constitución para cambiar el equilibrio de poderes.", effectsJson: { powerConcentration: 15, judicialIndependence: -10, politicalPluralism: -5, approval: { EXTREME_POVERTY: -2, POVERTY: -3, MIDDLE: -6, ELITE: 5 } }, idealIdeology: { economic: 10, social: -20, authority: 60 }, cost: 100000000 },
    { key: "despenalizacion-aborto", name: "Despenalización del Aborto", description: "Elimina las sanciones penales por interrupción del embarazo.", effectsJson: { approval: { EXTREME_POVERTY: -1, POVERTY: 0, MIDDLE: 5, ELITE: 3 }, civilLiberties: 10 }, idealIdeology: { economic: -10, social: 80, authority: -30 }, cost: 0 },
    { key: "ley-antimonopolios", name: "Ley Anti-Monopolios y Competencia", description: "Impide la concentración excesiva de mercado y promueve competencia.", effectsJson: { gdp: 5, gini: -4, approval: { EXTREME_POVERTY: 3, POVERTY: 4, MIDDLE: 3, ELITE: -6 } }, idealIdeology: { economic: -30, social: 20, authority: 0 }, cost: 150000000 },
  ];

  for (const ley of leyes) {
    await prisma.lawCatalog.create({ data: ley });
  }
  console.log("  ✓ 15 leyes en catálogo");

  // ─── Clases sociales ──────────────────────────────────────────────────────

  const clasesData = [
    { key: "EXTREME_POVERTY" as const, populationPercent: 12, averageIncome: 150, approval: 45, demands: ["alimentación", "empleo", "vivienda"], educationLevel: 15, healthAccess: 25 },
    { key: "POVERTY" as const, populationPercent: 28, averageIncome: 400, approval: 48, demands: ["empleo", "seguridad", "salud"], educationLevel: 30, healthAccess: 45 },
    { key: "MIDDLE" as const, populationPercent: 52, averageIncome: 2000, approval: 62, demands: ["estabilidad", "educación", "libertad económica"], educationLevel: 65, healthAccess: 70 },
    { key: "ELITE" as const, populationPercent: 8, averageIncome: 15000, approval: 55, demands: ["libertad económica", "baja tributación", "seguridad jurídica"], educationLevel: 90, healthAccess: 95 },
  ];

  for (const c of clasesData) {
    await prisma.socialClass.create({ data: { gameId: game.id, ...c } });
  }
  console.log("  ✓ 4 clases sociales creadas");

  // ─── Medios de comunicación ───────────────────────────────────────────────

  const mediosData = [
    { name: "Canal Nacional", type: "TV" as const, ideologicalAffinity: { economic: 20, social: -10, authority: 30 }, reach: 70, credibility: 40, governmentAffinity: 60 },
    { name: "El Independiente", type: "NEWSPAPER" as const, ideologicalAffinity: { economic: 0, social: 30, authority: -20 }, reach: 50, credibility: 75, governmentAffinity: 0 },
    { name: "Voz Ciudadana Digital", type: "DIGITAL" as const, ideologicalAffinity: { economic: -30, social: 50, authority: -50 }, reach: 45, credibility: 55, governmentAffinity: -40 },
  ];

  for (const m of mediosData) {
    await prisma.media.create({ data: { gameId: game.id, ...m } });
  }
  console.log("  ✓ 3 medios creados");

  // ─── Métricas de régimen iniciales ────────────────────────────────────────

  await prisma.regimeMetrics.create({
    data: {
      gameId: game.id,
      powerConcentration: 28,
      pressFreedom: 72,
      judicialIndependence: 65,
      politicalPluralism: 75,
      civilLiberties: 73,
      transparency: 52,
      militarySubordination: 62,
    },
  });
  console.log("  ✓ Métricas de régimen creadas");

  // ─── Snapshot inicial (mes 0) ─────────────────────────────────────────────

  await prisma.monthSnapshot.create({
    data: {
      gameId: game.id,
      year: 1,
      month: 0,
      treasury: 5000000000,
      gdp: 250000000000,
      population: 45000000,
      approval: 57.4,
      corruption: 9.2,
      povertyRate: 14.5,
      unemploymentRate: 7.2,
      sickRate: 3.1,
      crimeRate: 8.4,
      foodSecurity: 85,
      educationLevel: 58,
      inflation: 3.2,
      gini: 42,
      regimeType: "Democracia defectuosa",
      regimeMetrics: {
        powerConcentration: 28,
        pressFreedom: 72,
        judicialIndependence: 65,
        politicalPluralism: 75,
        civilLiberties: 73,
        transparency: 52,
        militarySubordination: 62,
      },
    },
  });
  console.log("  ✓ Snapshot inicial creado");

  console.log("\n✅ Seed completado exitosamente.");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
