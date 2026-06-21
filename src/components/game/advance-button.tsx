"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/store/game-store";
import { Button } from "@/components/ui/button";
import { NotificationsPanel } from "@/components/game/notifications-panel";
import { Loader2, Play } from "lucide-react";

function computeNextMonth(currentMonth: number, currentYear: number) {
  if (currentMonth >= 12) {
    return { month: 1, year: currentYear + 1 };
  }
  return { month: currentMonth + 1, year: currentYear };
}

export function AdvanceButton() {
  const gameState = useGameStore((s) => s.gameState);
  const isLoading = useGameStore((s) => s.isLoading);
  const advanceMonth = useGameStore((s) => s.advanceMonth);
  const [showNotifications, setShowNotifications] = useState(false);

  let nextLabel = "...";
  if (gameState) {
    const { month, year } = computeNextMonth(gameState.currentMonth, gameState.currentYear);
    nextLabel = `Avanzar a Mes ${month} del Año ${year}`;
  }

  async function handleAdvance() {
    try {
      await advanceMonth();
      setShowNotifications(true);
    } catch {
      // El store ya maneja el error internamente
    }
  }

  return (
    <>
      <Button
        size="lg"
        onClick={handleAdvance}
        disabled={!gameState || isLoading}
        className="gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Procesando...
          </>
        ) : (
          <>
            <Play className="size-4" />
            {nextLabel}
          </>
        )}
      </Button>
      <NotificationsPanel
        open={showNotifications}
        onOpenChange={setShowNotifications}
      />
    </>
  );
}
