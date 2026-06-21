"use client";

import { useEffect } from "react";
import { useGameStore } from "@/lib/store/game-store";
import { getGameState } from "@/app/actions/game";
import { getDemoGameId } from "@/app/actions/demo";
import { IndicatorCards } from "@/components/game/indicator-cards";
import { EventFeed } from "@/components/game/event-feed";
import { AdvanceButton } from "@/components/game/advance-button";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const gameState = useGameStore((s) => s.gameState);
  const setGameState = useGameStore((s) => s.setGameState);
  const setGameId = useGameStore((s) => s.setGameId);

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
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          Panel de Control — {gameState.countryName}
        </h1>
        <AdvanceButton />
      </div>
      <IndicatorCards />
      <EventFeed />
    </div>
  );
}
