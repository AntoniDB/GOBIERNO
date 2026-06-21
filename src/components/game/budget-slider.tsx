"use client";

import { useMemo } from "react";
import { useGameStore } from "@/lib/store/game-store";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
// Límites del slider: deben coincidir con BALANCE.MIN_BUDGET_PERCENT / MAX_BUDGET_PERCENT
// definidos en src/lib/balance.ts. El motor clampa a [2, 40] en turn.ts.
const BUDGET_MIN = 2;
const BUDGET_MAX = 40;

const MINISTRY_NAMES: Record<string, string> = {
  HEALTH: "Salud",
  EDUCATION: "Educación",
  ECONOMY: "Economía",
  DEFENSE: "Defensa",
  SECURITY: "Seguridad",
  JUSTICE: "Justicia",
  AGRICULTURE: "Agricultura",
  SOCIAL_DEVELOPMENT: "Desarrollo Social",
};

const MINISTRY_SEGMENT_COLORS: Record<string, string> = {
  HEALTH: "bg-red-500",
  EDUCATION: "bg-blue-500",
  ECONOMY: "bg-emerald-500",
  DEFENSE: "bg-slate-500",
  SECURITY: "bg-amber-500",
  JUSTICE: "bg-purple-500",
  AGRICULTURE: "bg-lime-500",
  SOCIAL_DEVELOPMENT: "bg-pink-500",
};

interface BudgetSliderProps {
  ministryKey: string;
  currentBudget: number;
  onBudgetChange: (key: string, value: number) => void;
}

export function BudgetSlider({ ministryKey, currentBudget, onBudgetChange }: BudgetSliderProps) {
  const gameState = useGameStore((s) => s.gameState);
  const allMinistries = useMemo(() => gameState?.ministries ?? [], [gameState?.ministries]);

  const totalBudget = useMemo(() => {
    return allMinistries.reduce((sum, m) => {
      if (m.key === ministryKey) return sum + currentBudget;
      return sum + m.budgetPercent;
    }, 0);
  }, [allMinistries, ministryKey, currentBudget]);

  const remaining = 100 - totalBudget;

  function getBudgetLevelColor(value: number) {
    if (value < 20) return "bg-accent";
    if (value <= 30) return "bg-chart-5";
    return "bg-destructive";
  }

  const budgetLevelColor = getBudgetLevelColor(currentBudget);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground">Presupuesto asignado</Label>
          <span className="text-sm font-bold tabular-nums text-foreground">
            {currentBudget.toFixed(1)}%
          </span>
        </div>

        <div className="h-2 w-full rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${budgetLevelColor}`}
            style={{ width: `${Math.min(currentBudget / BUDGET_MAX * 100, 100)}%` }}
          />
        </div>

        <Slider
          value={[currentBudget]}
          min={BUDGET_MIN}
          max={BUDGET_MAX}
          step={0.5}
          onValueChange={(v) => onBudgetChange(ministryKey, Array.isArray(v) ? v[0] : v)}
        />

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{BUDGET_MIN}%</span>
          <span className="text-muted-foreground">{BUDGET_MAX}%</span>
        </div>
      </div>

      <div className="space-y-2">
        {remaining >= 0 ? (
          <p className="text-xs text-muted-foreground">
            Restante para otros ministerios:{" "}
            <span className="font-medium text-foreground">{remaining.toFixed(1)}%</span>
          </p>
        ) : (
          <p className="text-xs">
            <span className="text-destructive font-medium">
              Déficit: {Math.abs(remaining).toFixed(1)}%
            </span>
            <span className="text-muted-foreground">
              {" "}— El presupuesto total supera el 100%
            </span>
          </p>
        )}

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Distribución total</p>
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
            {allMinistries.map((m) => {
              const displayPct = m.key === ministryKey ? currentBudget : m.budgetPercent;
              if (displayPct <= 0) return null;
              return (
                <div
                  key={m.key}
                  className={`h-full transition-all ${MINISTRY_SEGMENT_COLORS[m.key] ?? "bg-muted-foreground"}`}
                  style={{ width: `${displayPct}%` }}
                  title={`${MINISTRY_NAMES[m.key] ?? m.key}: ${displayPct.toFixed(1)}%`}
                />
              );
            })}
            {remaining > 0 && (
              <div
                className="h-full bg-muted-foreground/20"
                style={{ width: `${remaining}%` }}
                title={`Restante: ${remaining.toFixed(1)}%`}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {allMinistries.map((m) => {
              const displayPct = m.key === ministryKey ? currentBudget : m.budgetPercent;
              return (
                <div key={m.key} className="flex items-center gap-1 text-xs">
                  <span
                    className={`inline-block size-2 rounded-full ${MINISTRY_SEGMENT_COLORS[m.key] ?? "bg-muted-foreground"}`}
                  />
                  <span className="text-muted-foreground">
                    {MINISTRY_NAMES[m.key] ?? m.key} {displayPct.toFixed(1)}%
                  </span>
                </div>
              );
            })}
            {remaining > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <span className="inline-block size-2 rounded-full bg-muted-foreground/20" />
                <span className="text-muted-foreground">Restante {remaining.toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
