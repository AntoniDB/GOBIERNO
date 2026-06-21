-- CreateEnum
CREATE TYPE "MinistryKey" AS ENUM ('HEALTH', 'EDUCATION', 'ECONOMY', 'DEFENSE', 'SECURITY', 'JUSTICE', 'AGRICULTURE', 'SOCIAL_DEVELOPMENT', 'FOREIGN_AFFAIRS', 'ENVIRONMENT', 'LABOR', 'INFRASTRUCTURE', 'CULTURE', 'SCIENCE_TECH');

-- CreateEnum
CREATE TYPE "OfficialRole" AS ENUM ('MINISTER', 'JUDGE', 'PROSECUTOR', 'GENERAL', 'CHIEF_OF_INTELLIGENCE', 'COMPTROLLER', 'OMBUDSMAN', 'CENTRAL_BANK_PRESIDENT');

-- CreateEnum
CREATE TYPE "OfficialStatus" AS ENUM ('ACTIVE', 'INVESTIGATED', 'INDICTED', 'CONVICTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "Chamber" AS ENUM ('LOWER', 'UPPER');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CaseType" AS ENUM ('CORRUPTION', 'CRIMINAL', 'CIVIL');

-- CreateEnum
CREATE TYPE "CasePhase" AS ENUM ('INVESTIGATION', 'TRIAL', 'SENTENCING', 'APPEAL', 'CLOSED');

-- CreateEnum
CREATE TYPE "OrganismType" AS ENUM ('COMPTROLLER', 'ANTICORRUPTION_PROSECUTION', 'INTELLIGENCE', 'OMBUDSMAN', 'CONSTITUTIONAL_COURT', 'CENTRAL_BANK', 'TAX_AGENCY', 'ELECTORAL_COUNCIL');

-- CreateEnum
CREATE TYPE "SocialClassKey" AS ENUM ('EXTREME_POVERTY', 'POVERTY', 'MIDDLE', 'ELITE');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('TV', 'NEWSPAPER', 'DIGITAL');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('ACTIVE', 'CENSORED', 'CLOSED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('EPIDEMIC', 'SCANDAL', 'PROTEST', 'CRIME_SURGE', 'COUP_ATTEMPT', 'DISASTER', 'DISCOVERY', 'ECONOMIC_CRISIS', 'LEAK', 'OTHER');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('ACTIVE', 'PAUSED', 'FINISHED');

-- CreateEnum
CREATE TYPE "InfrastructureType" AS ENUM ('ENERGY', 'WATER', 'ROADS', 'RAIL', 'INTERNET', 'HOUSING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "currentYear" INTEGER NOT NULL DEFAULT 1,
    "currentMonth" INTEGER NOT NULL DEFAULT 1,
    "status" "GameStatus" NOT NULL DEFAULT 'ACTIVE',
    "seed" TEXT NOT NULL,
    "preset" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'normal',
    "treasury" DOUBLE PRECISION NOT NULL DEFAULT 1000000,
    "population" INTEGER NOT NULL DEFAULT 10000000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthSnapshot" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "treasury" DOUBLE PRECISION NOT NULL,
    "gdp" DOUBLE PRECISION NOT NULL,
    "population" INTEGER NOT NULL,
    "approval" DOUBLE PRECISION NOT NULL,
    "corruption" DOUBLE PRECISION NOT NULL,
    "povertyRate" DOUBLE PRECISION NOT NULL,
    "unemploymentRate" DOUBLE PRECISION NOT NULL,
    "sickRate" DOUBLE PRECISION NOT NULL,
    "crimeRate" DOUBLE PRECISION NOT NULL,
    "foodSecurity" DOUBLE PRECISION NOT NULL,
    "educationLevel" DOUBLE PRECISION NOT NULL,
    "inflation" DOUBLE PRECISION NOT NULL,
    "gini" DOUBLE PRECISION NOT NULL,
    "regimeType" TEXT NOT NULL,
    "regimeMetrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ministry" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "key" "MinistryKey" NOT NULL,
    "budgetPercent" DOUBLE PRECISION NOT NULL DEFAULT 12.5,
    "efficiency" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "internalCorruption" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "subDecisions" JSONB NOT NULL DEFAULT '{}',
    "ministerOfficialId" TEXT,

    CONSTRAINT "Ministry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistryDecision" (
    "id" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MinistryDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Official" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "OfficialRole" NOT NULL,
    "ministryId" TEXT,
    "partyId" TEXT,
    "loyalty" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "ambition" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "wealth" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "ideology" JSONB NOT NULL DEFAULT '{"economic":0,"social":0,"authority":0}',
    "corruption" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "skill" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "reputation" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "status" "OfficialStatus" NOT NULL DEFAULT 'ACTIVE',
    "appointedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Official_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ideology" JSONB NOT NULL DEFAULT '{"economic":0,"social":0,"authority":0}',
    "leaderOfficialId" TEXT,
    "popularity" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "seatsLower" INTEGER NOT NULL DEFAULT 0,
    "seatsUpper" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Senator" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "personalIdeology" JSONB NOT NULL DEFAULT '{"economic":0,"social":0,"authority":0}',
    "chamber" "Chamber" NOT NULL,
    "loyalty" DOUBLE PRECISION NOT NULL DEFAULT 50,

    CONSTRAINT "Senator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LawCatalog" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "effectsJson" JSONB NOT NULL,
    "idealIdeology" JSONB NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LawCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LawProposal" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "lawKey" TEXT NOT NULL,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "votesFor" INTEGER NOT NULL DEFAULT 0,
    "votesAgainst" INTEGER NOT NULL DEFAULT 0,
    "votesAbstain" INTEGER NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "LawProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveLaw" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "lawKey" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repealedAt" TIMESTAMP(3),

    CONSTRAINT "ActiveLaw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudicialCase" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "defendantOfficialId" TEXT NOT NULL,
    "caseType" "CaseType" NOT NULL,
    "description" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPhase" "CasePhase" NOT NULL DEFAULT 'INVESTIGATION',
    "monthsInPhase" INTEGER NOT NULL DEFAULT 0,
    "evidenceStrength" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "prosecutorId" TEXT,
    "judgeId" TEXT,
    "verdict" TEXT,
    "sentenceMonths" INTEGER,

    CONSTRAINT "JudicialCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investigation" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "openedBy" TEXT NOT NULL,
    "monthsActive" INTEGER NOT NULL DEFAULT 0,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Investigation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organism" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "type" "OrganismType" NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "staff" INTEGER NOT NULL DEFAULT 0,
    "effectiveness" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "autonomyLevel" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "headOfficialId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dissolvedAt" TIMESTAMP(3),

    CONSTRAINT "Organism_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialClass" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "key" "SocialClassKey" NOT NULL,
    "populationPercent" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "averageIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "approval" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "demands" JSONB NOT NULL DEFAULT '[]',
    "educationLevel" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "healthAccess" DOUBLE PRECISION NOT NULL DEFAULT 50,

    CONSTRAINT "SocialClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegimeMetrics" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "powerConcentration" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "pressFreedom" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "judicialIndependence" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "politicalPluralism" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "civilLiberties" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "transparency" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "militarySubordination" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegimeMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "ideologicalAffinity" JSONB NOT NULL DEFAULT '{"economic":0,"social":0,"authority":0}',
    "reach" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "credibility" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "governmentAffinity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "MediaStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaCoverage" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "eventId" TEXT,
    "headline" TEXT NOT NULL,
    "sentiment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impactOnApproval" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "MediaCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "severity" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "effectsApplied" JSONB NOT NULL DEFAULT '{}',
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationStatus" TEXT NOT NULL DEFAULT 'neutral',
    "militaryPower" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "economicPower" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "isNeighbor" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Treaty" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Treaty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disease" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contagionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "mortalityRate" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "prevalence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hasVaccine" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Disease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Infrastructure" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "type" "InfrastructureType" NOT NULL,
    "coveragePercent" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "maintenanceCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "condition" DOUBLE PRECISION NOT NULL DEFAULT 50,

    CONSTRAINT "Infrastructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "populationPercent" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "povertyRate" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "infrastructureLevel" DOUBLE PRECISION NOT NULL DEFAULT 50,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Game_userId_idx" ON "Game"("userId");

-- CreateIndex
CREATE INDEX "Game_status_idx" ON "Game"("status");

-- CreateIndex
CREATE INDEX "MonthSnapshot_gameId_idx" ON "MonthSnapshot"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthSnapshot_gameId_year_month_key" ON "MonthSnapshot"("gameId", "year", "month");

-- CreateIndex
CREATE INDEX "Ministry_gameId_idx" ON "Ministry"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Ministry_gameId_key_key" ON "Ministry"("gameId", "key");

-- CreateIndex
CREATE INDEX "MinistryDecision_ministryId_idx" ON "MinistryDecision"("ministryId");

-- CreateIndex
CREATE INDEX "Official_gameId_idx" ON "Official"("gameId");

-- CreateIndex
CREATE INDEX "Official_role_idx" ON "Official"("role");

-- CreateIndex
CREATE INDEX "Official_status_idx" ON "Official"("status");

-- CreateIndex
CREATE INDEX "Party_gameId_idx" ON "Party"("gameId");

-- CreateIndex
CREATE INDEX "Senator_gameId_idx" ON "Senator"("gameId");

-- CreateIndex
CREATE INDEX "Senator_partyId_idx" ON "Senator"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "LawCatalog_key_key" ON "LawCatalog"("key");

-- CreateIndex
CREATE INDEX "LawProposal_gameId_idx" ON "LawProposal"("gameId");

-- CreateIndex
CREATE INDEX "LawProposal_status_idx" ON "LawProposal"("status");

-- CreateIndex
CREATE INDEX "ActiveLaw_gameId_idx" ON "ActiveLaw"("gameId");

-- CreateIndex
CREATE INDEX "JudicialCase_gameId_idx" ON "JudicialCase"("gameId");

-- CreateIndex
CREATE INDEX "JudicialCase_currentPhase_idx" ON "JudicialCase"("currentPhase");

-- CreateIndex
CREATE INDEX "Investigation_caseId_idx" ON "Investigation"("caseId");

-- CreateIndex
CREATE INDEX "Organism_gameId_idx" ON "Organism"("gameId");

-- CreateIndex
CREATE INDEX "Organism_type_idx" ON "Organism"("type");

-- CreateIndex
CREATE INDEX "SocialClass_gameId_idx" ON "SocialClass"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialClass_gameId_key_key" ON "SocialClass"("gameId", "key");

-- CreateIndex
CREATE INDEX "RegimeMetrics_gameId_idx" ON "RegimeMetrics"("gameId");

-- CreateIndex
CREATE INDEX "Media_gameId_idx" ON "Media"("gameId");

-- CreateIndex
CREATE INDEX "MediaCoverage_mediaId_idx" ON "MediaCoverage"("mediaId");

-- CreateIndex
CREATE INDEX "MediaCoverage_gameId_idx" ON "MediaCoverage"("gameId");

-- CreateIndex
CREATE INDEX "MediaCoverage_gameId_year_month_idx" ON "MediaCoverage"("gameId", "year", "month");

-- CreateIndex
CREATE INDEX "Event_gameId_idx" ON "Event"("gameId");

-- CreateIndex
CREATE INDEX "Event_gameId_year_month_idx" ON "Event"("gameId", "year", "month");

-- CreateIndex
CREATE INDEX "Country_gameId_idx" ON "Country"("gameId");

-- CreateIndex
CREATE INDEX "Treaty_gameId_idx" ON "Treaty"("gameId");

-- CreateIndex
CREATE INDEX "Treaty_countryId_idx" ON "Treaty"("countryId");

-- CreateIndex
CREATE INDEX "Disease_gameId_idx" ON "Disease"("gameId");

-- CreateIndex
CREATE INDEX "Infrastructure_gameId_idx" ON "Infrastructure"("gameId");

-- CreateIndex
CREATE INDEX "Region_gameId_idx" ON "Region"("gameId");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthSnapshot" ADD CONSTRAINT "MonthSnapshot_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ministry" ADD CONSTRAINT "Ministry_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ministry" ADD CONSTRAINT "Ministry_ministerOfficialId_fkey" FOREIGN KEY ("ministerOfficialId") REFERENCES "Official"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryDecision" ADD CONSTRAINT "MinistryDecision_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Official" ADD CONSTRAINT "Official_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Official" ADD CONSTRAINT "Official_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_leaderOfficialId_fkey" FOREIGN KEY ("leaderOfficialId") REFERENCES "Official"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Senator" ADD CONSTRAINT "Senator_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Senator" ADD CONSTRAINT "Senator_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawProposal" ADD CONSTRAINT "LawProposal_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveLaw" ADD CONSTRAINT "ActiveLaw_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudicialCase" ADD CONSTRAINT "JudicialCase_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudicialCase" ADD CONSTRAINT "JudicialCase_defendantOfficialId_fkey" FOREIGN KEY ("defendantOfficialId") REFERENCES "Official"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudicialCase" ADD CONSTRAINT "JudicialCase_prosecutorId_fkey" FOREIGN KEY ("prosecutorId") REFERENCES "Official"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudicialCase" ADD CONSTRAINT "JudicialCase_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "Official"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investigation" ADD CONSTRAINT "Investigation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "JudicialCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organism" ADD CONSTRAINT "Organism_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organism" ADD CONSTRAINT "Organism_headOfficialId_fkey" FOREIGN KEY ("headOfficialId") REFERENCES "Official"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialClass" ADD CONSTRAINT "SocialClass_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegimeMetrics" ADD CONSTRAINT "RegimeMetrics_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaCoverage" ADD CONSTRAINT "MediaCoverage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaCoverage" ADD CONSTRAINT "MediaCoverage_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Country" ADD CONSTRAINT "Country_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treaty" ADD CONSTRAINT "Treaty_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disease" ADD CONSTRAINT "Disease_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Infrastructure" ADD CONSTRAINT "Infrastructure_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
