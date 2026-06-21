"use client";

import type { LawProposalData } from "@/app/actions/congress";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ThumbsUpIcon,
  ThumbsDownIcon,
  ClockIcon,
  ScrollTextIcon,
} from "lucide-react";

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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "APPROVED":
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
          <ThumbsUpIcon className="size-3" />
          Aprobada
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge variant="destructive" className="gap-1">
          <ThumbsDownIcon className="size-3" />
          Rechazada
        </Badge>
      );
    case "PENDING":
      return (
        <Badge variant="secondary" className="gap-1 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          <ClockIcon className="size-3" />
          Pendiente
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function LawProposalsHistory({
  proposals,
}: {
  proposals: LawProposalData[];
}) {
  if (proposals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <ScrollTextIcon className="size-12 opacity-30" />
        <p>No hay propuestas de ley registradas.</p>
      </div>
    );
  }

  return (
    <Card size="sm" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-4 text-muted-foreground font-medium text-xs">
                Ley
              </th>
              <th className="text-left py-2 px-4 text-muted-foreground font-medium text-xs">
                Fecha propuesta
              </th>
              <th className="text-center py-2 px-4 text-muted-foreground font-medium text-xs">
                Votos
              </th>
              <th className="text-center py-2 px-4 text-muted-foreground font-medium text-xs">
                Resultado
              </th>
              <th className="text-left py-2 px-4 text-muted-foreground font-medium text-xs">
                Fecha resolución
              </th>
            </tr>
          </thead>
          <tbody>
            {proposals.map((p) => (
              <tr
                key={p.id}
                className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="py-2 px-4 font-medium text-foreground max-w-[180px] truncate">
                  {LAW_NAMES[p.lawKey] ?? p.lawKey}
                </td>
                <td className="py-2 px-4 text-muted-foreground text-xs tabular-nums">
                  {formatDate(p.proposedAt)}
                </td>
                <td className="py-2 px-4">
                  <div className="flex items-center justify-center gap-2 text-xs">
                    <span className="text-emerald-400 tabular-nums">{p.votesFor}</span>
                    <span className="text-muted-foreground text-[10px]">/</span>
                    <span className="text-red-400 tabular-nums">{p.votesAgainst}</span>
                    <span className="text-muted-foreground text-[10px]">/</span>
                    <span className="text-muted-foreground tabular-nums">{p.votesAbstain}</span>
                  </div>
                </td>
                <td className="py-2 px-4 text-center">
                  <StatusBadge status={p.status} />
                </td>
                <td className="py-2 px-4 text-muted-foreground text-xs tabular-nums">
                  {p.resolvedAt ? formatDate(p.resolvedAt) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
