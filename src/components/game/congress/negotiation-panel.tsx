"use client";

import Link from "next/link";
import type { PartyState, OfficialState, MinistryState } from "@/lib/engine/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  HandshakeIcon,
  BuildingIcon,
  UserIcon,
  InfoIcon,
} from "lucide-react";

const PARTY_COLORS: Record<string, string> = {
  "Partido Conservador Nacional": "#dc2626",
  "Alianza Progresista": "#2563eb",
  "Unión Democrática Social": "#ca8a04",
  "Movimiento Obrero Popular": "#b91c1c",
  "Frente Liberal Republicano": "#7c3aed",
};

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

export function NegotiationPanel({
  parties,
  officials,
  ministries,
}: {
  parties: PartyState[];
  officials: OfficialState[];
  ministries: MinistryState[];
}) {
  const partyMinisters = new Map<string, { ministerName: string; ministryKey: string }[]>();

  for (const ministry of ministries) {
    if (!ministry.ministerOfficialId) continue;
    const minister = officials.find((o) => o.id === ministry.ministerOfficialId);
    if (!minister || !minister.partyId) continue;

    const list = partyMinisters.get(minister.partyId) ?? [];
    list.push({
      ministerName: minister.name,
      ministryKey: ministry.key,
    });
    partyMinisters.set(minister.partyId, list);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/50">
        <InfoIcon className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1 text-sm">
          <p className="text-foreground font-medium">
            Influencia ministerial en el Congreso
          </p>
          <p className="text-muted-foreground">
            Para ganar apoyo en el Congreso, puedes nombrar ministros de los
            partidos que quieras convencer. Los senadores de un partido con un
            ministro en el gabinete votan con{" "}
            <span className="text-primary font-medium">+20% de afinidad</span>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {parties.map((party) => {
          const color = PARTY_COLORS[party.name] ?? "#6b7280";
          const ministersOfParty = partyMinisters.get(party.id) ?? [];
          const hasMinister = ministersOfParty.length > 0;

          return (
            <Card key={party.id} size="sm">
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block size-3 rounded-full shrink-0 border border-white/10"
                    style={{ backgroundColor: color }}
                  />
                  <h3 className="font-heading text-sm font-medium text-foreground truncate">
                    {party.name}
                  </h3>
                  {hasMinister && (
                    <Badge className="ml-auto bg-primary/20 text-primary border-primary/30 text-[10px]">
                      En gabinete
                    </Badge>
                  )}
                </div>

                {hasMinister ? (
                  <div className="space-y-1">
                    {ministersOfParty.map((m) => (
                      <div
                        key={m.ministryKey}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <BuildingIcon className="size-3" />
                        <span>{MINISTRY_NAMES[m.ministryKey] ?? m.ministryKey}</span>
                        <span className="text-foreground/60">— {m.ministerName}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <UserIcon className="size-3" />
                    <span>Sin representación en el gabinete</span>
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Baja: {party.seatsLower}</span>
                  <span>Alta: {party.seatsUpper}</span>
                  <span>Pop: {party.popularity.toFixed(0)}%</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <HandshakeIcon className="size-4" />
        <span>
          Para cambiar ministros, ve a la página de{" "}
          <Link href="/ministerios" className="text-primary underline underline-offset-2 hover:text-primary/80">
            Ministerios
          </Link>
          .
        </span>
      </div>
    </div>
  );
}
