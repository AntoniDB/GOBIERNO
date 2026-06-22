"use client";

import { useGameStore } from "@/lib/store/game-store";
import { Bell } from "lucide-react";
import { AdvanceButton } from "@/components/game/advance-button";

function formatTreasury(value: number): string {
  const millions = Math.round(value / 1_000_000);
  return `M$ ${millions}`;
}

function getApprovalColor(value: number): string {
  if (value > 60) return "text-accent";
  if (value >= 35) return "text-yellow-400";
  return "text-destructive";
}

function getCorruptionColor(value: number): string {
  if (value < 20) return "text-accent";
  if (value <= 40) return "text-yellow-400";
  return "text-destructive";
}

function getRegimeBadgeClass(regimeType: string): string {
  switch (regimeType) {
    case "Democracia plena":
      return "bg-accent/20 text-accent";
    case "Democracia defectuosa":
      return "bg-yellow-400/20 text-yellow-400";
    case "Régimen híbrido":
      return "bg-orange-400/20 text-orange-400";
    case "Autoritarismo electoral":
      return "bg-destructive/20 text-destructive";
    case "Dictadura":
      return "bg-destructive text-destructive-foreground";
    case "Estado fallido":
      return "bg-destructive/80 text-destructive-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default function HUD() {
  const gameState = useGameStore((s) => s.gameState);
  const notifications = useGameStore((s) => s.notifications);
  const lastTurnResult = useGameStore((s) => s.lastTurnResult);

  if (!gameState) {
    return (
      <div className="bg-card border-b border-border px-6 py-3">
        <p className="text-sm text-muted-foreground animate-pulse">
          Cargando...
        </p>
      </div>
    );
  }

  const snapshot = lastTurnResult?.monthSnapshot;
  const treasuryFormatted = formatTreasury(gameState.treasury);
  const treasuryColor =
    gameState.treasury > 0 ? "text-accent" : "text-destructive";

  return (
    <div className="bg-card border-b border-border px-6 py-3 flex items-center gap-4 text-sm shrink-0">
      <span className="text-foreground whitespace-nowrap">
        Año {gameState.currentYear}, Mes {gameState.currentMonth}
      </span>

      <div className="h-5 w-px bg-border shrink-0" />

      <span
        className={`whitespace-nowrap font-medium ${treasuryColor}`}
        title={`Tesoro: $${gameState.treasury.toLocaleString("es-ES")}`}
      >
        {treasuryFormatted}
      </span>

      <div className="h-5 w-px bg-border shrink-0" />

      <span
        className={`whitespace-nowrap ${
          snapshot ? getApprovalColor(snapshot.approval) : "text-muted-foreground"
        }`}
      >
        Aprobación{" "}
        {snapshot ? `${snapshot.approval}%` : "—%"}
      </span>

      <div className="h-5 w-px bg-border shrink-0" />

      <span
        className={`whitespace-nowrap ${
          snapshot ? getCorruptionColor(snapshot.corruption) : "text-muted-foreground"
        }`}
      >
        Corrupción{" "}
        {snapshot ? `${snapshot.corruption}%` : "—%"}
      </span>

      <div className="h-5 w-px bg-border shrink-0" />

      {snapshot?.regimeType ? (
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${getRegimeBadgeClass(
            snapshot.regimeType
          )}`}
        >
          {snapshot.regimeType}
        </span>
      ) : (
        <span className="text-muted-foreground whitespace-nowrap">—</span>
      )}

      <div className="flex-1" />

      <AdvanceButton />

      <button
        className="relative p-1.5 rounded hover:bg-muted transition-colors shrink-0"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {notifications.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] rounded-full h-4 min-w-4 px-1 flex items-center justify-center font-bold leading-none">
            {notifications.length > 99 ? "99+" : notifications.length}
          </span>
        )}
      </button>
    </div>
  );
}
