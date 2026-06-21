"use client";

import { useMemo } from "react";
import type { SenatorState, PartyState } from "@/lib/engine/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

const PARTY_COLORS: Record<string, string> = {
  "Partido Conservador Nacional": "#dc2626",
  "Alianza Progresista": "#2563eb",
  "Unión Democrática Social": "#ca8a04",
  "Movimiento Obrero Popular": "#b91c1c",
  "Frente Liberal Republicano": "#7c3aed",
};

function getPartyColor(partyId: string, parties: PartyState[]): string {
  const party = parties.find((p) => p.id === partyId);
  if (!party) return "#6b7280";
  return PARTY_COLORS[party.name] ?? "#6b7280";
}

function getPartyName(partyId: string, parties: PartyState[]): string {
  const party = parties.find((p) => p.id === partyId);
  return party?.name ?? "Independiente";
}

interface SeatPosition {
  x: number;
  y: number;
}

function generateArcPositions(
  count: number,
  radius: number,
  centerX: number,
  centerY: number,
  startAngleDeg: number,
  endAngleDeg: number,
): SeatPosition[] {
  if (count <= 1) {
    const midAngle = ((startAngleDeg + endAngleDeg) / 2) * (Math.PI / 180);
    return [{ x: centerX + radius * Math.cos(midAngle), y: centerY - radius * Math.sin(midAngle) }];
  }

  const positions: SeatPosition[] = [];
  for (let i = 0; i < count; i++) {
    const angleDeg = startAngleDeg + (i / (count - 1)) * (endAngleDeg - startAngleDeg);
    const angleRad = angleDeg * (Math.PI / 180);
    positions.push({
      x: centerX + radius * Math.cos(angleRad),
      y: centerY - radius * Math.sin(angleRad),
    });
  }
  return positions;
}

export function SenateHemicycle({
  senators,
  parties,
}: {
  senators: SenatorState[];
  parties: PartyState[];
}) {
  const lowerSenators = useMemo(
    () => senators.filter((s) => s.chamber === "LOWER"),
    [senators],
  );
  const upperSenators = useMemo(
    () => senators.filter((s) => s.chamber === "UPPER"),
    [senators],
  );

  const lowerPositions = useMemo(
    () => generateArcPositions(lowerSenators.length, 130, 180, 170, 180, 0),
    [lowerSenators.length],
  );
  const upperPositions = useMemo(
    () => generateArcPositions(upperSenators.length, 80, 180, 145, 180, 0),
    [upperSenators.length],
  );

  return (
    <TooltipProvider delay={200}>
      <div className="space-y-6">
        {/* Cámara Baja */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Cámara Baja</span>
            <span className="text-xs text-muted-foreground">
              ({lowerSenators.length} escaños)
            </span>
          </div>
          <div className="relative mx-auto" style={{ width: 380, height: 200 }}>
            {lowerSenators.map((senator, idx) => {
              const pos = lowerPositions[idx];
              if (!pos) return null;
              const color = getPartyColor(senator.partyId, parties);
              const partyName = getPartyName(senator.partyId, parties);

              return (
                <Tooltip key={senator.id}>
                  <TooltipTrigger
                    className="absolute rounded-full border border-white/10 cursor-pointer transition-transform hover:scale-125 hover:z-10"
                    style={{
                      width: 22,
                      height: 22,
                      left: pos.x - 11,
                      top: pos.y - 11,
                      backgroundColor: color,
                    }}
                  />
                  <TooltipContent side="top" className="max-w-[200px]">
                    <div className="space-y-0.5">
                      <p className="font-medium">{senator.name}</p>
                      <p className="text-[10px] opacity-80">{partyName}</p>
                      <p className="text-[10px] opacity-70">
                        E:{senator.personalIdeology.economic} S:{senator.personalIdeology.social} A:{senator.personalIdeology.authority}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Cámara Alta */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Cámara Alta</span>
            <span className="text-xs text-muted-foreground">
              ({upperSenators.length} escaños)
            </span>
          </div>
          <div className="relative mx-auto" style={{ width: 280, height: 140 }}>
            {upperSenators.map((senator, idx) => {
              const pos = upperPositions[idx];
              if (!pos) return null;
              const color = getPartyColor(senator.partyId, parties);
              const partyName = getPartyName(senator.partyId, parties);

              return (
                <Tooltip key={senator.id}>
                  <TooltipTrigger
                    className="absolute rounded-full border border-white/10 cursor-pointer transition-transform hover:scale-125 hover:z-10"
                    style={{
                      width: 22,
                      height: 22,
                      left: pos.x - 11,
                      top: pos.y - 11,
                      backgroundColor: color,
                    }}
                  />
                  <TooltipContent side="top" className="max-w-[200px]">
                    <div className="space-y-0.5">
                      <p className="font-medium">{senator.name}</p>
                      <p className="text-[10px] opacity-80">{partyName}</p>
                      <p className="text-[10px] opacity-70">
                        E:{senator.personalIdeology.economic} S:{senator.personalIdeology.social} A:{senator.personalIdeology.authority}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Leyenda de partidos */}
        <div className="flex flex-wrap gap-3 justify-center">
          {parties.map((party) => (
            <div key={party.id} className="flex items-center gap-1.5 text-xs">
              <span
                className="inline-block size-3 rounded-full border border-white/10"
                style={{ backgroundColor: PARTY_COLORS[party.name] ?? "#6b7280" }}
              />
              <span className="text-muted-foreground">{party.name}</span>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
