// @ts-nocheck — Capa de persistencia: mapeo entre tipos planos del motor y Prisma 7.
// ─── Persistencia del turno ───────────────────────────────────────────────────
// Guarda en una sola transacción el resultado de `processTurn`. Vive aparte de turn.ts
// ("use server" solo admite exportar server actions) para poder probarla y reutilizarla.
//
// Rendimiento: cada sentencia dentro de la transacción es una ida y vuelta a la base de datos.
// Contra un Postgres remoto (≈200 ms) el centenar de `update`/`upsert` uno a uno tardaba >20 s y
// superaba el timeout de 5 s de Prisma, así que los bucles por fila se agrupan en una sentencia
// por tabla (ver turn-batch.ts). El resultado en la base de datos es idéntico.

import {
  updateMinistries, upsertOfficials, updateSocialClasses, updateRegions,
  updateDiseases, upsertDiseasePrevalences, upsertResourceStocks,
} from "./turn-batch";

export interface PersistTurnContext {
  gameId: string;
  game: { currentYear: number; currentMonth: number };
  newYear: number;
  newMonth: number;
  newState: any;
  monthSnapshot: any;
  newEvents: any[];
  mediaCoverages: any[];
  lawResults: any[];
  enactedKeys: string[];
  gameOver: boolean;
}

export async function persistTurn(tx: any, ctx: PersistTurnContext): Promise<void> {
  const { gameId, game, newYear, newMonth, newState, monthSnapshot, newEvents, mediaCoverages, lawResults, enactedKeys, gameOver } = ctx;
  // a. MonthSnapshot: INSERT ON CONFLICT (atómico, nunca P2002/25P02)
  const snapYear = game.currentYear;
  const snapMonth = game.currentMonth;
  const snapId = crypto.randomUUID();
  const regimeMetricsJson = JSON.stringify(monthSnapshot.regimeMetrics);
  const diseasePrevalencesJson = JSON.stringify(monthSnapshot.diseasePrevalences);
  await tx.$executeRaw`
    INSERT INTO "MonthSnapshot" (
      "id", "gameId", "year", "month",
      "treasury", "gdp", "population", "approval", "corruption",
      "povertyRate", "unemploymentRate", "sickRate", "crimeRate",
      "foodSecurity", "educationLevel", "inflation", "gini",
      "regimeType", "regimeMetrics", "lifeExpectancy",
      "activeLrdCount", "lrdMonthlyCost", "lrdCompletedThisMonth", "lrdCancelledThisMonth",
      "activeProgramsCount", "programMonthlyCost",
      "diseasePrevalences", "tradeBalance", "totalImports", "totalExports"
    ) VALUES (
      ${snapId}::uuid, ${gameId}::uuid, ${snapYear}, ${snapMonth},
      ${monthSnapshot.treasury}, ${monthSnapshot.gdp}, ${monthSnapshot.population},
      ${monthSnapshot.approval}, ${monthSnapshot.corruption},
      ${monthSnapshot.povertyRate}, ${monthSnapshot.unemploymentRate},
      ${monthSnapshot.sickRate}, ${monthSnapshot.crimeRate},
      ${monthSnapshot.foodSecurity}, ${monthSnapshot.educationLevel},
      ${monthSnapshot.inflation}, ${monthSnapshot.gini},
      ${monthSnapshot.regimeType}, ${regimeMetricsJson}::jsonb, ${monthSnapshot.lifeExpectancy},
      ${monthSnapshot.activeLrdCount}, ${monthSnapshot.lrdMonthlyCost},
      ${monthSnapshot.lrdCompletedThisMonth}, ${monthSnapshot.lrdCancelledThisMonth},
      ${monthSnapshot.activeProgramsCount}, ${monthSnapshot.programMonthlyCost},
      ${diseasePrevalencesJson}::jsonb, ${monthSnapshot.tradeBalance},
      ${monthSnapshot.totalImports}, ${monthSnapshot.totalExports}
    )
    ON CONFLICT ("gameId", "year", "month")
    DO UPDATE SET
      "treasury" = ${monthSnapshot.treasury},
      "gdp" = ${monthSnapshot.gdp},
      "population" = ${monthSnapshot.population},
      "approval" = ${monthSnapshot.approval},
      "corruption" = ${monthSnapshot.corruption},
      "povertyRate" = ${monthSnapshot.povertyRate},
      "unemploymentRate" = ${monthSnapshot.unemploymentRate},
      "sickRate" = ${monthSnapshot.sickRate},
      "crimeRate" = ${monthSnapshot.crimeRate},
      "foodSecurity" = ${monthSnapshot.foodSecurity},
      "educationLevel" = ${monthSnapshot.educationLevel},
      "inflation" = ${monthSnapshot.inflation},
      "gini" = ${monthSnapshot.gini},
      "regimeType" = ${monthSnapshot.regimeType},
      "regimeMetrics" = ${regimeMetricsJson}::jsonb,
      "lifeExpectancy" = ${monthSnapshot.lifeExpectancy},
      "activeLrdCount" = ${monthSnapshot.activeLrdCount},
      "lrdMonthlyCost" = ${monthSnapshot.lrdMonthlyCost},
      "lrdCompletedThisMonth" = ${monthSnapshot.lrdCompletedThisMonth},
      "lrdCancelledThisMonth" = ${monthSnapshot.lrdCancelledThisMonth},
      "activeProgramsCount" = ${monthSnapshot.activeProgramsCount},
      "programMonthlyCost" = ${monthSnapshot.programMonthlyCost},
      "diseasePrevalences" = ${diseasePrevalencesJson}::jsonb,
      "tradeBalance" = ${monthSnapshot.tradeBalance},
      "totalImports" = ${monthSnapshot.totalImports},
      "totalExports" = ${monthSnapshot.totalExports}
  `;

  // b. Ministerios (una sola sentencia)
  await updateMinistries(tx, newState.ministries);

  // c. Officials (upsert para soportar nuevos candidatos)
  await upsertOfficials(tx, gameId, newState.officials);

  // d. SocialClasses
  await updateSocialClasses(tx, newState.socialClasses);

  // e. Crear RegimeMetrics
  await tx.regimeMetrics.create({
    data: {
      gameId,
      powerConcentration: newState.regimeMetrics.powerConcentration,
      pressFreedom: newState.regimeMetrics.pressFreedom,
      judicialIndependence: newState.regimeMetrics.judicialIndependence,
      politicalPluralism: newState.regimeMetrics.politicalPluralism,
      civilLiberties: newState.regimeMetrics.civilLiberties,
      transparency: newState.regimeMetrics.transparency,
      militarySubordination: newState.regimeMetrics.militarySubordination,
    },
  });

  // f. Actualizar Game (después del snapshot para cerrar ventana de doble-click)
    await tx.game.update({
      where: { id: gameId },
      data: {
        currentYear: newYear,
        currentMonth: newMonth,
        treasury: newState.treasury,
        population: newState.population,
        consecutiveLowApprovalMonths: newState.consecutiveLowApprovalMonths ?? 0,
        healthEfficiencyStreak: newState.healthEfficiencyStreak ?? 0,
        consecutiveSaturationMonths: newState.consecutiveSaturationMonths ?? {},
        status: gameOver ? ("FINISHED" as const) : undefined,
        sanctionsMultiplier: newState.sanctionsMultiplier ?? 1.0,
      },
    });

  // g. LongRunningDecisions: upsert cada LRD
  for (const lrd of newState.longRunningDecisions) {
    await tx.longRunningDecision.upsert({
      where: { id: lrd.id },
      create: {
        id: lrd.id,
        game: { connect: { id: gameId } },
        type: lrd.type as string,
        name: lrd.name,
        monthsRemaining: lrd.monthsRemaining,
        totalMonths: lrd.totalMonths,
        monthlyCost: lrd.monthlyCost,
        parameters: lrd.parameters as Record<string, unknown>,
        status: lrd.status as string,
        startedAt: new Date(lrd.startedAt),
        completedAt: lrd.completedAt ? new Date(lrd.completedAt) : null,
        cancelledAt: lrd.cancelledAt ? new Date(lrd.cancelledAt) : null,
        progressLog: lrd.progressLog ?? [],
        effectOnCompletion: lrd.effectOnCompletion as Record<string, unknown>,
      },
      update: {
        monthsRemaining: lrd.monthsRemaining,
        monthlyCost: lrd.monthlyCost,
        parameters: lrd.parameters as Record<string, unknown>,
        status: lrd.status as string,
        completedAt: lrd.completedAt ? new Date(lrd.completedAt) : null,
        cancelledAt: lrd.cancelledAt ? new Date(lrd.cancelledAt) : null,
        progressLog: lrd.progressLog ?? [],
        effectOnCompletion: lrd.effectOnCompletion as Record<string, unknown>,
      },
    });
  }

  // i. ResourceStocks: INSERT ON CONFLICT (atómico, nunca P2002/25P02)
  await upsertResourceStocks(tx, gameId, newState.resourceStocks);

  // i.2 TradeFlows: upsert por gameId + tradeGoodId + direction
  for (const tf of newState.tradeFlows ?? []) {
    await tx.tradeFlow.upsert({
      where: { id: tf.id },
      create: {
        id: tf.id,
        game: { connect: { id: gameId } },
        tradeGood: { connect: { id: tf.tradeGoodId } },
        direction: tf.direction as string,
        monthlyVolume: tf.monthlyVolume,
        targetVolume: tf.targetVolume,
        unitCost: tf.unitCost,
        sanctionsMultiplier: tf.sanctionsMultiplier,
        monthlyCost: tf.monthlyCost,
        isActive: tf.isActive,
      },
      update: {
        monthlyVolume: tf.monthlyVolume,
        targetVolume: tf.targetVolume,
        unitCost: tf.unitCost,
        sanctionsMultiplier: tf.sanctionsMultiplier,
        monthlyCost: tf.monthlyCost,
        isActive: tf.isActive,
      },
    });
  }

  // j. Regions: update healthCoverage y otros campos
  await updateRegions(tx, newState.regions);

  // k. DiseasePrevalence: INSERT ON CONFLICT (atómico, nunca P2002/25P02)
  await upsertDiseasePrevalences(tx, gameId, newState.diseasePrevalences);

  // k.2 Diseases: persistir cambios de hasVaccine/mortalityRate (Salud-3A investigacion)
  await updateDiseases(tx, newState.diseases ?? []);

  // l. Programas operativos (Salud-3A Capa D): upsert
  for (const prog of newState.programs ?? []) {
    await tx.ministryProgram.upsert({
      where: { id: prog.id },
      create: {
        id: prog.id,
        game: { connect: { id: gameId } },
        type: prog.type as string,
        parameters: prog.parameters as Record<string, unknown>,
        monthlyCost: prog.monthlyCost,
        status: prog.status as string,
        startedAt: new Date(prog.startedAt),
        deactivatedAt: prog.deactivatedAt ? new Date(prog.deactivatedAt) : null,
      },
      update: {
        parameters: prog.parameters as Record<string, unknown>,
        status: prog.status as string,
        deactivatedAt: prog.deactivatedAt ? new Date(prog.deactivatedAt) : null,
      },
    });
  }

  // h. JudicialCases — con verificacion anti-duplicados a nivel DB
  for (const jc of newState.judicialCases) {
    // Para casos nuevos de corrupcion, verificar que no exista ya uno activo
    // del mismo tipo para el mismo funcionario. Esto es la ultima linea de defensa:
    // el motor puro tambien chequea, pero una constraint a nivel DB garantiza integridad.
    if (jc.id.startsWith("auto-") && jc.caseType === "CORRUPTION") {
      const existing = await tx.judicialCase.findFirst({
        where: {
          defendantOfficialId: jc.defendantOfficialId,
          caseType: jc.caseType as string,
          currentPhase: { not: "CLOSED" as const },
          id: { not: jc.id },
        },
        select: { id: true },
      });
      if (existing) {
        // Ya existe un caso activo del mismo tipo para este funcionario. Saltar.
        continue;
      }
    }

    await tx.judicialCase.upsert({
      where: { id: jc.id },
      create: {
        id: jc.id,
        game: { connect: { id: gameId } },
        defendant: { connect: { id: jc.defendantOfficialId } },
        caseType: jc.caseType as string,
        description: `Caso ${jc.caseType.toLowerCase()} abierto contra funcionario`,
        currentPhase: jc.currentPhase as string,
        monthsInPhase: jc.monthsInPhase,
        evidenceStrength: jc.evidenceStrength,
        prosecutor: jc.prosecutorId ? { connect: { id: jc.prosecutorId } } : undefined,
        judge: jc.judgeId ? { connect: { id: jc.judgeId } } : undefined,
        verdict: jc.verdict,
        sentenceMonths: jc.sentenceMonths,
      },
      update: {
        currentPhase: jc.currentPhase as string,
        monthsInPhase: jc.monthsInPhase,
        evidenceStrength: jc.evidenceStrength,
        prosecutor: jc.prosecutorId ? { connect: { id: jc.prosecutorId } } : { disconnect: true },
        judge: jc.judgeId ? { connect: { id: jc.judgeId } } : { disconnect: true },
        verdict: jc.verdict,
        sentenceMonths: jc.sentenceMonths,
      },
    });
  }

  // h. Organismos: upsert (nuevos creados por el jugador)
  for (const org of newState.organisms) {
    // Si el organismo esta siendo disuelto, registrar la fecha
    const isDissolved = org.effectiveness <= 0;
    const existingOrg = isDissolved
      ? await tx.organism.findUnique({ where: { id: org.id }, select: { dissolvedAt: true } })
      : null;
    const dissolvedAt = isDissolved
      ? (existingOrg?.dissolvedAt ?? new Date())
      : null;

    await tx.organism.upsert({
      where: { id: org.id },
      create: {
        id: org.id,
        game: { connect: { id: gameId } },
        type: org.type as string,
        name: org.name,
        monthlyBudget: org.monthlyBudget,
        staff: org.staff,
        effectiveness: org.effectiveness,
        autonomyLevel: org.autonomyLevel,
        headOfficial: org.headOfficialId ? { connect: { id: org.headOfficialId } } : undefined,
        dissolvedAt,
      },
      update: {
        monthlyBudget: org.monthlyBudget,
        staff: org.staff,
        effectiveness: org.effectiveness,
        autonomyLevel: org.autonomyLevel,
        headOfficial: org.headOfficialId ? { connect: { id: org.headOfficialId } } : { disconnect: true },
        dissolvedAt,
      },
    });
  }

  // i. Eventos
  if (newEvents.length > 0) {
    await tx.event.createMany({
      data: newEvents.map((evt) => ({
        gameId,
        type: evt.type as string,
        severity: evt.severity,
        year: evt.year,
        month: evt.month,
        description: evt.description,
        effectsApplied: evt.effectsApplied as Record<string, unknown>,
        resolvedAt: evt.resolvedAt ? new Date(evt.resolvedAt) : null,
      })),
    });
  }

  // i. MediaCoverages
  if (mediaCoverages.length > 0) {
    await tx.mediaCoverage.createMany({
      data: mediaCoverages.map((mc) => ({
        id: crypto.randomUUID(),
        mediaId: mc.mediaId,
        gameId,
        year: game.currentYear,
        month: game.currentMonth,
        headline: mc.headline,
        sentiment: mc.sentiment,
        impactOnApproval: mc.impactOnApproval as Record<string, unknown>,
      })),
    });
  }

  // j. Leyes propuestas (y activas, una vez por ley promulgada)
  const pendingEnactment = new Set(enactedKeys);
  const resolvedAt = new Date();
  const activeLaws = [];
  for (const result of lawResults) {
    if (result.approved && pendingEnactment.delete(result.lawKey)) {
      activeLaws.push({ id: crypto.randomUUID(), gameId, lawKey: result.lawKey });
    }
  }
  if (lawResults.length > 0) {
    await tx.lawProposal.createMany({
      data: lawResults.map((result) => ({
        id: crypto.randomUUID(),
        gameId,
        lawKey: result.lawKey,
        status: result.approved ? "APPROVED" as const : "REJECTED" as const,
        votesFor: result.votesFor,
        votesAgainst: result.votesAgainst,
        votesAbstain: result.votesAbstain,
        resolvedAt,
      })),
    });
  }
  if (activeLaws.length > 0) await tx.activeLaw.createMany({ data: activeLaws });
}
