"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store/game-store";
import { getGameState, getSnapshots } from "@/app/actions/game";
import { getDemoGameId } from "@/app/actions/demo";
import { IndicatorCards } from "@/components/game/indicator-cards";
import { ApprovalBreakdown } from "@/components/game/approval-breakdown";
import { EventFeed } from "@/components/game/event-feed";
import { AdvanceButton } from "@/components/game/advance-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function DashboardPage() {
  const gameState = useGameStore((s) => s.gameState);
  const setGameState = useGameStore((s) => s.setGameState);
  const setGameId = useGameStore((s) => s.setGameId);
  const setSnapshots = useGameStore((s) => s.setSnapshots);
  const [loaded, setLoaded] = useState(false);
  const [noGames, setNoGames] = useState(false);

  useEffect(() => {
    getDemoGameId().then((id) => {
      if (!id) {
        setLoaded(true);
        setNoGames(true);
        return;
      }
      setGameId(id);
      Promise.all([getGameState(id), getSnapshots(id)]).then(([state, snapshots]) => {
        if (state) setGameState(state);
        if (snapshots) setSnapshots(snapshots);
        setLoaded(true);
      });
    });
  }, [setGameId, setGameState, setSnapshots]);

  if (!loaded) {
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

  if (noGames || !gameState) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Sin partidas activas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              No tienes ninguna partida en curso. Crea una nueva para empezar a gobernar.
            </p>
            <Link href="/nueva-partida">
              <Button size="lg">Nueva Partida</Button>
            </Link>
          </CardContent>
        </Card>
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
      <ApprovalBreakdown />
      <EventFeed />
    </div>
  );
}
