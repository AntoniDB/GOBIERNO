import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function backfill() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  const games = await prisma.game.findMany({
    where: {
      tradeGoods: { none: {} },
    },
    select: { id: true, population: true },
  });

  console.log(`Found ${games.length} games without TradeGood records.`);

  for (const game of games) {
    const demandBase = Math.ceil((game.population ?? 10000000) * 0.00001);

    const genericGood = await prisma.tradeGood.create({
      data: {
        gameId: game.id,
        key: "medicamentos_genericos",
        category: "MEDICAMENTS_GENERIC",
        name: "Medicamentos genéricos",
        description: "Medicamentos esenciales de bajo costo para cobertura basica",
        baseCostPerUnit: 50,
        unitDescription: "Tratamiento mensual para 100 personas",
        demandPerCapita: 0.00001,
      },
    });

    const brandGood = await prisma.tradeGood.create({
      data: {
        gameId: game.id,
        key: "medicamentos_marca",
        category: "MEDICAMENTS_BRAND",
        name: "Medicamentos de marca",
        description: "Farmacos de patente con mayor efectividad y menor mortalidad",
        baseCostPerUnit: 200,
        unitDescription: "Tratamiento mensual para 100 personas",
        demandPerCapita: 0.00001,
      },
    });

    await prisma.tradeFlow.create({
      data: {
        gameId: game.id,
        tradeGoodId: genericGood.id,
        direction: "IMPORT",
        monthlyVolume: Math.ceil(demandBase * 0.7),
        targetVolume: Math.ceil(demandBase * 0.7),
        unitCost: 50,
        sanctionsMultiplier: 1.0,
        monthlyCost: Math.ceil(demandBase * 0.7) * 50,
        isActive: true,
      },
    });

    await prisma.tradeFlow.create({
      data: {
        gameId: game.id,
        tradeGoodId: brandGood.id,
        direction: "IMPORT",
        monthlyVolume: Math.ceil(demandBase * 0.3),
        targetVolume: Math.ceil(demandBase * 0.3),
        unitCost: 200,
        sanctionsMultiplier: 1.0,
        monthlyCost: Math.ceil(demandBase * 0.3) * 200,
        isActive: true,
      },
    });

    console.log(`  Backfilled game ${game.id}`);
  }

  await prisma.$disconnect();
  console.log("Done.");
}

backfill().catch((e) => {
  console.error(e);
  process.exit(1);
});
