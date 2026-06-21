"use client";

import type { PartyState, OfficialState } from "@/lib/engine/types";
import { Card, CardContent } from "@/components/ui/card";
import { UsersIcon, CrownIcon } from "lucide-react";

const PARTY_COLORS: Record<string, string> = {
  "Partido Conservador Nacional": "#dc2626",
  "Alianza Progresista": "#2563eb",
  "Unión Democrática Social": "#ca8a04",
  "Movimiento Obrero Popular": "#b91c1c",
  "Frente Liberal Republicano": "#7c3aed",
};

function IdeologyBars({
  economic,
  social,
  authority,
}: {
  economic: number;
  social: number;
  authority: number;
}) {
  const items = [
    { label: "Económico", value: economic },
    { label: "Social", value: social },
    { label: "Autoridad", value: authority },
  ];

  return (
    <div className="space-y-1.5">
      {items.map((item) => {
        const clamped = Math.max(-100, Math.min(100, item.value));
        return (
          <div key={item.label} className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-16 text-right">
              {item.label}
            </span>
            <div className="h-1.5 flex-1 rounded-full bg-muted relative overflow-hidden">
              <div className="absolute top-0 left-1/2 w-px h-full bg-border/50 z-10" />
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.abs(clamped) / 2}%`,
                  marginLeft: clamped >= 0 ? "50%" : `${50 - Math.abs(clamped) / 2}%`,
                  background: clamped >= 0
                    ? `oklch(${0.55 + Math.abs(clamped) / 300} 0.25 ${25 - clamped / 10})`
                    : `oklch(${0.55 + Math.abs(clamped) / 300} 0.22 ${240 + clamped / 2})`,
                }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground w-8 tabular-nums">
              {item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function PartyList({
  parties,
  officials,
}: {
  parties: PartyState[];
  officials: OfficialState[];
}) {
  const sorted = [...parties].sort(
    (a, b) => b.seatsLower + b.seatsUpper - (a.seatsLower + a.seatsUpper),
  );

  const totalLower = sorted.reduce((s, p) => s + p.seatsLower, 0);
  const totalUpper = sorted.reduce((s, p) => s + p.seatsUpper, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <UsersIcon className="size-4" />
        <span>
          {sorted.length} partidos — Baja: {totalLower} escaños, Alta: {totalUpper} escaños
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sorted.map((party) => {
          const leader = officials.find((o) => o.id === party.leaderOfficialId);
          const color = PARTY_COLORS[party.name] ?? "#6b7280";

          return (
            <Card key={party.id} size="sm">
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1 inline-block size-3 rounded-full shrink-0 border border-white/10"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0">
                    <h3 className="font-heading text-base font-medium text-foreground truncate">
                      {party.name}
                    </h3>
                    {leader && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <CrownIcon className="size-3 text-yellow-400" />
                        {leader.name}
                      </p>
                    )}
                  </div>
                </div>

                <IdeologyBars
                  economic={party.ideology.economic}
                  social={party.ideology.social}
                  authority={party.ideology.authority}
                />

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Popularidad</span>
                    <span className="tabular-nums text-foreground font-medium">
                      {party.popularity.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${party.popularity}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="inline-block size-2 rounded-full bg-blue-400" />
                    Baja: {party.seatsLower}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block size-2 rounded-full bg-purple-400" />
                    Alta: {party.seatsUpper}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
