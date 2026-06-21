"use client";

import { useMemo } from "react";
import { useGameStore } from "@/lib/store/game-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface EfficiencyChartProps {
  ministryKey: string;
}

export function EfficiencyChart({ ministryKey }: EfficiencyChartProps) {
  const gameState = useGameStore((s) => s.gameState);

  const ministry = gameState?.ministries.find((m) => m.key === ministryKey);
  const currentEfficiency = ministry?.efficiency ?? 50;

  const data = useMemo(() => {
    const baseMonth = gameState ? gameState.currentMonth : 1;

    const seededRandom = (seed: number) => {
      let s = seed;
      return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
      };
    };

    const rand = seededRandom(baseMonth * 100 + currentEfficiency);

    return [
      {
        label: `Mes ${baseMonth - 1}`,
        eficiencia: Math.min(100, Math.max(0, currentEfficiency + (rand() * 8 - 4))),
      },
      {
        label: `Mes ${baseMonth === 1 ? 12 : baseMonth - 1}`,
        eficiencia: Math.min(100, Math.max(0, currentEfficiency + (rand() * 6 - 3))),
      },
      {
        label: `Mes ${baseMonth} (actual)`,
        eficiencia: currentEfficiency,
      },
    ];
  }, [currentEfficiency, gameState]);

  if (!gameState) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-sm text-muted-foreground text-center">Cargando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-heading font-medium">Eficiencia histórica</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-muted)" />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                axisLine={{ stroke: "var(--color-border)" }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                axisLine={{ stroke: "var(--color-border)" }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "0.5rem",
                  color: "var(--color-foreground)",
                  fontSize: "0.75rem",
                }}
                formatter={(value) => [`${Number(value).toFixed(1)}%`, "Eficiencia"]}
                labelStyle={{ color: "var(--color-muted-foreground)" }}
              />
              <Line
                type="monotone"
                dataKey="eficiencia"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={{ fill: "var(--color-primary)", r: 3 }}
                activeDot={{ r: 5, fill: "var(--color-primary)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
