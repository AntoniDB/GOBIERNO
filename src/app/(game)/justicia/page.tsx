"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store/game-store";
import { getGameState } from "@/app/actions/game";
import { getDemoGameId } from "@/app/actions/demo";
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
import { ScaleIcon, UsersIcon, Building2Icon } from "lucide-react";
import { CaseList } from "@/components/game/justicia/case-list";
import { OfficialList } from "@/components/game/justicia/official-list";
import { OrganismList } from "@/components/game/justicia/organism-list";

export default function JusticiaPage() {
  const gameState = useGameStore((s) => s.gameState);
  const setGameState = useGameStore((s) => s.setGameState);
  const setGameId = useGameStore((s) => s.setGameId);

  const [activeTab, setActiveTab] = useState("casos");

  useEffect(() => {
    getDemoGameId().then((id) => {
      if (!id) return;
      setGameId(id);
      getGameState(id).then((state) => {
        if (state) setGameState(state);
      });
    });
  }, [setGameId, setGameState]);

  if (!gameState) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-96" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Justicia</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="text-2xl font-bold text-foreground">
        Sistema de Justicia
      </h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="casos">
            <ScaleIcon className="size-4" />
            Casos activos
          </TabsTrigger>
          <TabsTrigger value="funcionarios">
            <UsersIcon className="size-4" />
            Funcionarios
          </TabsTrigger>
          <TabsTrigger value="organismos">
            <Building2Icon className="size-4" />
            Organismos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="casos">
          <CaseList
            cases={gameState.judicialCases}
            officials={gameState.officials}
          />
        </TabsContent>

        <TabsContent value="funcionarios">
          <OfficialList
            officials={gameState.officials}
            onInvestigate={(officialId) => {
              const pendingInput = useGameStore.getState().pendingInput;
              useGameStore.setState({
                pendingInput: {
                  ...pendingInput,
                  investigations: [
                    ...(pendingInput.investigations ?? []),
                    officialId,
                  ],
                },
              });
            }}
          />
        </TabsContent>

        <TabsContent value="organismos">
          <OrganismList
            organisms={gameState.organisms}
            officials={gameState.officials}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
