"use client";

import { useGameStore } from "@/lib/store/game-store";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingDown,
  Briefcase,
  HeartPulse,
  ShieldAlert,
  GraduationCap,
  Wheat,
  DollarSign,
  TrendingUp,
  Heart,
} from "lucide-react";

type IndicatorKind = "lower-better" | "higher-better";

interface IndicatorDef {
  key: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  unit: string;
  kind: IndicatorKind;
  getValue: (s: NonNullable<ReturnType<typeof useGameStore.getState>["gameState"]>) => number;
  maxValue: number;
  thresholds: { green: number; yellow: number };
  formatValue: (v: number) => string;
}

const INDICATORS: IndicatorDef[] = [
  {
    key: "poverty",
    label: "Pobreza",
    icon: TrendingDown,
    unit: "%",
    kind: "lower-better",
    getValue: (s) => s.povertyRate,
    maxValue: 100,
    thresholds: { green: 15, yellow: 30 },
    formatValue: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: "unemployment",
    label: "Desempleo",
    icon: Briefcase,
    unit: "%",
    kind: "lower-better",
    getValue: (s) => s.unemploymentRate,
    maxValue: 30,
    thresholds: { green: 6, yellow: 12 },
    formatValue: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: "health",
    label: "Salud / Enfermos",
    icon: HeartPulse,
    unit: "%",
    kind: "lower-better",
    getValue: (s) => s.sickRate,
    maxValue: 20,
    thresholds: { green: 5, yellow: 10 },
    formatValue: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: "crime",
    label: "Crimen",
    icon: ShieldAlert,
    unit: "%",
    kind: "lower-better",
    getValue: (s) => s.crimeRate,
    maxValue: 40,
    thresholds: { green: 10, yellow: 25 },
    formatValue: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: "education",
    label: "Educación",
    icon: GraduationCap,
    unit: "/ 100",
    kind: "higher-better",
    getValue: (s) => s.educationLevel,
    maxValue: 100,
    thresholds: { green: 70, yellow: 40 },
    formatValue: (v) => `${v.toFixed(0)}`,
  },
  {
    key: "food",
    label: "Seg. Alimentaria",
    icon: Wheat,
    unit: "%",
    kind: "higher-better",
    getValue: (s) => s.foodSecurity,
    maxValue: 100,
    thresholds: { green: 75, yellow: 50 },
    formatValue: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: "gdp",
    label: "PIB",
    icon: DollarSign,
    unit: "",
    kind: "higher-better",
    getValue: (s) => s.gdp,
    maxValue: 100_000_000_000,
    thresholds: { green: 30_000_000_000, yellow: 10_000_000_000 },
    formatValue: (v) => {
      const b = v / 1e9;
      return `M$ ${b.toFixed(1)}`;
    },
  },
  {
    key: "inflation",
    label: "Inflación",
    icon: TrendingUp,
    unit: "%",
    kind: "lower-better",
    getValue: (s) => s.inflation,
    maxValue: 20,
    thresholds: { green: 3, yellow: 10 },
    formatValue: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: "lifeExpectancy",
    label: "Esp. de Vida",
    icon: Heart,
    unit: "años",
    kind: "higher-better",
    getValue: (s) => s.lifeExpectancy,
    maxValue: 85,
    thresholds: { green: 75, yellow: 65 },
    formatValue: (v) => `${v.toFixed(1)}`,
  },
];

function getColorClass(value: number, thresholds: IndicatorDef["thresholds"], kind: IndicatorKind) {
  if (kind === "lower-better") {
    if (value <= thresholds.green) return "bg-accent";
    if (value <= thresholds.yellow) return "bg-chart-5";
    return "bg-destructive";
  }
  if (value >= thresholds.green) return "bg-accent";
  if (value >= thresholds.yellow) return "bg-chart-5";
  return "bg-destructive";
}

function MiniProgress({
  value,
  maxValue,
  colorClass,
}: {
  value: number;
  maxValue: number;
  colorClass: string;
}) {
  const percent = Math.min(Math.round((value / maxValue) * 100), 100);
  return (
    <div className="h-1.5 w-full rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-all ${colorClass}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function IndicatorCards() {
  const gameState = useGameStore((s) => s.gameState);

  if (!gameState) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {INDICATORS.map((ind) => {
        const value = ind.getValue(gameState);
        const colorClass = getColorClass(value, ind.thresholds, ind.kind);
        return (
          <Card key={ind.key} size="sm">
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <ind.icon className={`size-4 ${colorClass.replace("bg-", "text-")}`} />
                <span className="text-xs font-medium text-muted-foreground">{ind.label}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-foreground">
                  {ind.formatValue(value)}
                </span>
                {ind.unit && (
                  <span className="text-xs text-muted-foreground">{ind.unit}</span>
                )}
              </div>
              <MiniProgress value={value} maxValue={ind.maxValue} colorClass={colorClass} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
