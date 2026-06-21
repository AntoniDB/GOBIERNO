"use client";

import type { ActiveLawState } from "@/lib/engine/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollTextIcon, CalendarIcon } from "lucide-react";

const LAW_NAMES: Record<string, string> = {
  "subsidio-alimentario": "Subsidio Alimentario",
  "impuesto-progresivo": "Impuesto Progresivo a la Renta",
  "ley-anticorrupcion": "Ley Anticorrupción Integral",
  "servicio-militar-obligatorio": "Servicio Militar Obligatorio",
  "educacion-publica-gratuita": "Educación Pública Gratuita Universal",
  "salud-universal": "Sistema de Salud Universal",
  "liberalizacion-economica": "Liberalización Económica",
  "estado-emergencia": "Estado de Emergencia Nacional",
  "reforma-judicial": "Reforma del Poder Judicial",
  "ley-transparencia": "Ley de Transparencia",
  "libertad-prensa": "Libertad de Prensa Garantizada",
  "censura-medios": "Ley de Regulación de Contenidos Mediáticos",
  "reforma-constitucional": "Reforma Constitucional",
  "despenalizacion-aborto": "Despenalización del Aborto",
  "ley-antimonopolios": "Ley Anti-Monopolios",
};

function getClassLabel(key: string): string {
  const map: Record<string, string> = {
    EXTREME_POVERTY: "Extrema",
    POVERTY: "Pobre",
    MIDDLE: "Media",
    ELITE: "Élite",
  };
  return map[key] ?? key;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ActiveLaws({ activeLaws }: { activeLaws: ActiveLawState[] }) {
  if (activeLaws.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <ScrollTextIcon className="size-12 opacity-30" />
        <p>No hay leyes activas.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {activeLaws.map((law) => {
        const name = LAW_NAMES[law.lawKey] ?? law.lawKey;
        const effects = law.effectsJson as Record<string, unknown>;

        return (
          <Card key={law.id} size="sm">
            <CardContent className="space-y-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">{name}</h3>
                <span className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <CalendarIcon className="size-3" />
                  Activada: {formatDate(law.activatedAt)}
                </span>
              </div>

              <div className="flex flex-wrap gap-1">
                {(() => {
                  const badges: React.ReactNode[] = [];
                  const approvalEffects = effects.approval as Record<string, number> | undefined;

                  if (approvalEffects) {
                    for (const [cls, change] of Object.entries(approvalEffects)) {
                      if (change === 0) continue;
                      badges.push(
                        <Badge
                          key={`app-${cls}`}
                          variant={change > 0 ? "default" : "destructive"}
                          className="text-[10px]"
                        >
                          {getClassLabel(cls)}: {change > 0 ? "+" : ""}{change}
                        </Badge>
                      );
                    }
                  }

                  for (const [key, val] of Object.entries(effects)) {
                    if (key === "approval") continue;
                    if (typeof val === "number" && val !== 0) {
                      badges.push(
                        <Badge
                          key={key}
                          variant={val > 0 ? "default" : "destructive"}
                          className="text-[10px]"
                        >
                          {key}: {val > 0 ? "+" : ""}{val}
                        </Badge>
                      );
                    }
                  }

                  if (badges.length === 0) {
                    badges.push(
                      <Badge key="none" variant="outline" className="text-[10px]">
                        Sin efectos visibles
                      </Badge>
                    );
                  }

                  return badges;
                })()}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
