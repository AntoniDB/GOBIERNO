"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store/game-store";
import { getGameState } from "@/app/actions/game";
import { getDemoGameId } from "@/app/actions/demo";
import { getCongressData } from "@/app/actions/congress";
import type { LawProposalData } from "@/app/actions/congress";
import type { LawCatalogEntry } from "@/lib/engine/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpenIcon,
  ScrollTextIcon,
  HistoryIcon,
  LandmarkIcon,
  GavelIcon,
} from "lucide-react";
import { LawCatalog, LawCatalogLoading } from "@/components/game/congress/law-catalog";
import { ActiveLaws } from "@/components/game/congress/active-laws";
import { LawProposalsHistory } from "@/components/game/congress/law-proposals-history";
import { SenateHemicycle } from "@/components/game/congress/senate-hemicycle";
import { PartyList } from "@/components/game/congress/party-list";
import { NegotiationPanel } from "@/components/game/congress/negotiation-panel";
import { MotionsPanel } from "@/components/game/congress/motions-panel";

export default function CongresoPage() {
  const gameState = useGameStore((s) => s.gameState);
  const setGameState = useGameStore((s) => s.setGameState);
  const setGameId = useGameStore((s) => s.setGameId);
  const pendingInput = useGameStore((s) => s.pendingInput);
  const proposedLaws = pendingInput.proposedLaws ?? [];
  const proposeLaw = useGameStore((s) => s.proposeLaw);

  const [lawCatalog, setLawCatalog] = useState<LawCatalogEntry[] | null>(null);
  const [lawProposals, setLawProposals] = useState<LawProposalData[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("catalogo");

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const id = await getDemoGameId();
      if (!id) {
        setIsLoading(false);
        return;
      }
      setGameId(id);

      const [state, congress] = await Promise.all([
        getGameState(id),
        getCongressData(id),
      ]);

      if (state) setGameState(state);
      if (congress) {
        setLawCatalog(congress.lawCatalog);
        setLawProposals(congress.lawProposals);
      }
      setIsLoading(false);
    }
    load();
  }, [setGameId, setGameState]);

  const generalApproval = (() => {
    if (!gameState?.socialClasses || gameState.socialClasses.length === 0) return 50;
    let weighted = 0;
    let total = 0;
    for (const sc of gameState.socialClasses) {
      weighted += sc.approval * sc.populationPercent;
      total += sc.populationPercent;
    }
    return total > 0 ? Math.round((weighted / total) * 10) / 10 : 50;
  })();

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Congreso</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="text-2xl font-bold text-foreground">
        Congreso Nacional
      </h1>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-8 w-72" />
          <LawCatalogLoading />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList variant="line" className="mb-4">
            <TabsTrigger value="catalogo">
              <BookOpenIcon className="size-4" />
              Catálogo
            </TabsTrigger>
            <TabsTrigger value="activas">
              <ScrollTextIcon className="size-4" />
              Leyes activas
            </TabsTrigger>
            <TabsTrigger value="historial">
              <HistoryIcon className="size-4" />
              Historial
            </TabsTrigger>
            <TabsTrigger value="senado">
              <LandmarkIcon className="size-4" />
              Senado
            </TabsTrigger>
            <TabsTrigger value="mociones">
              <GavelIcon className="size-4" />
              Mociones
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalogo">
            {lawCatalog ? (
              <LawCatalog
                laws={lawCatalog}
                proposedLaws={proposedLaws}
                onPropose={proposeLaw}
                senators={gameState?.senators ?? []}
                parties={gameState?.parties ?? []}
                approval={generalApproval}
              />
            ) : (
              <LawCatalogLoading />
            )}
          </TabsContent>

          <TabsContent value="activas">
            <ActiveLaws activeLaws={gameState?.activeLaws ?? []} />
          </TabsContent>

          <TabsContent value="historial">
            <LawProposalsHistory proposals={lawProposals ?? []} />
          </TabsContent>

          <TabsContent value="senado">
            <div className="space-y-8">
              <SenateHemicycle
                senators={gameState?.senators ?? []}
                parties={gameState?.parties ?? []}
              />
              <PartyList
                parties={gameState?.parties ?? []}
                officials={gameState?.officials ?? []}
              />
              <NegotiationPanel
                parties={gameState?.parties ?? []}
                officials={gameState?.officials ?? []}
                ministries={gameState?.ministries ?? []}
              />
            </div>
          </TabsContent>

          <TabsContent value="mociones">
            <MotionsPanel />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
