"use client";

import { useState } from "react";
import type { JudicialCaseState, OfficialState } from "@/lib/engine/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ScaleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  UserIcon,
  CalendarIcon,
  GavelIcon,
  FileTextIcon,
} from "lucide-react";

const CASE_TYPE_LABEL: Record<string, string> = {
  CORRUPTION: "Corrupción",
  CRIMINAL: "Criminal",
  CIVIL: "Civil",
};

const CASE_TYPE_BADGE: Record<string, "destructive" | "secondary" | "default"> = {
  CORRUPTION: "destructive",
  CRIMINAL: "secondary",
  CIVIL: "default",
};

const PHASE_LABEL: Record<string, string> = {
  INVESTIGATION: "Investigación",
  TRIAL: "Juicio",
  SENTENCING: "Sentencia",
  APPEAL: "Apelación",
  CLOSED: "Cerrado",
};

const PHASE_BADGE: Record<string, string> = {
  INVESTIGATION: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  TRIAL: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  SENTENCING: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  APPEAL: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  CLOSED: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

function findOfficial(id: string | null, officials: OfficialState[]): OfficialState | undefined {
  if (!id) return undefined;
  return officials.find((o) => o.id === id);
}

function EvidenceBar({ value }: { value: number }) {
  const pct = Math.round(value);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-16 shrink-0">Evidencia</span>
      <Progress value={value} className="flex-1" />
      <span className="text-xs text-muted-foreground tabular-nums w-10 shrink-0 text-right">{pct}%</span>
    </div>
  );
}

export function CaseList({
  cases,
  officials,
}: {
  cases: JudicialCaseState[];
  officials: OfficialState[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("Todos");

  const filtered = filter === "Todos" ? cases : cases.filter((c) => c.caseType === filter.toUpperCase());

  if (cases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <ScaleIcon className="size-12 opacity-30" />
        <p>No hay casos judiciales registrados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {["Todos", "Corrupción", "Criminal", "Civil"].map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="xs"
            onClick={() => setFilter(f)}
          >
            {f}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((c) => {
          const isExpanded = expandedId === c.id;
          const defendant = findOfficial(c.defendantOfficialId, officials);
          const prosecutor = findOfficial(c.prosecutorId, officials);
          const judge = findOfficial(c.judgeId, officials);

          return (
            <Card key={c.id} size="sm">
              <CardContent className="p-0">
                <button
                  type="button"
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  {isExpanded ? (
                    <ChevronDownIcon className="size-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRightIcon className="size-4 text-muted-foreground shrink-0" />
                  )}

                  <Badge variant={CASE_TYPE_BADGE[c.caseType] ?? "default"} className="shrink-0">
                    {CASE_TYPE_LABEL[c.caseType] ?? c.caseType}
                  </Badge>

                  <span className="flex-1 text-sm font-medium truncate">
                    {defendant?.name ?? "Desconocido"}
                  </span>

                  <Badge
                    variant="outline"
                    className={`shrink-0 text-[10px] ${PHASE_BADGE[c.currentPhase] ?? ""}`}
                  >
                    {PHASE_LABEL[c.currentPhase] ?? c.currentPhase}
                  </Badge>

                  <span className="text-xs text-muted-foreground shrink-0 w-20 text-right">
                    {c.monthsInPhase} mes{c.monthsInPhase !== 1 ? "es" : ""}
                  </span>

                  <div className="w-28 shrink-0 hidden md:block">
                    <EvidenceBar value={c.evidenceStrength} />
                  </div>

                  {c.verdict ? (
                    <Badge variant={c.verdict === "GUILTY" ? "destructive" : "default"} className="shrink-0 text-[10px]">
                      {c.verdict === "GUILTY" ? "Culpable" : "Inocente"}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground shrink-0 w-20 text-right">
                      Sin veredicto
                    </span>
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-4 bg-muted/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <FileTextIcon className="size-4 text-muted-foreground" />
                          Detalles del caso
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Tipo: {CASE_TYPE_LABEL[c.caseType] ?? c.caseType}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Fase actual: {PHASE_LABEL[c.currentPhase] ?? c.currentPhase}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Meses en fase: {c.monthsInPhase}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <UserIcon className="size-4 text-muted-foreground" />
                          Actores
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Acusado:{" "}
                          <span className="text-foreground font-medium">
                            {defendant?.name ?? "Desconocido"}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Fiscal:{" "}
                          <span className="text-foreground font-medium">
                            {prosecutor?.name ?? "No asignado"}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Juez:{" "}
                          <span className="text-foreground font-medium">
                            {judge?.name ?? "No asignado"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <ScaleIcon className="size-4 text-muted-foreground" />
                        Evidencia
                      </h4>
                      <EvidenceBar value={c.evidenceStrength} />
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <GavelIcon className="size-4 text-muted-foreground" />
                        Veredicto y sentencia
                      </h4>
                      {c.verdict ? (
                        <div className="space-y-1">
                          <p className="text-sm">
                            Veredicto:{" "}
                            <Badge variant={c.verdict === "GUILTY" ? "destructive" : "default"} className="text-[11px]">
                              {c.verdict === "GUILTY" ? "Culpable" : "Inocente"}
                            </Badge>
                          </p>
                          {c.sentenceMonths !== null && c.sentenceMonths > 0 && (
                            <p className="text-sm text-muted-foreground">
                              Sentencia: {c.sentenceMonths} meses de prisión
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No se ha emitido veredicto aún.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <CalendarIcon className="size-4 text-muted-foreground" />
                        Cronología
                      </h4>
                      <div className="space-y-1">
                        {["INVESTIGATION", "TRIAL", "SENTENCING", "APPEAL", "CLOSED"]
                          .filter((phase) => {
                            const phases = ["INVESTIGATION", "TRIAL", "SENTENCING", "APPEAL", "CLOSED"];
                            const currentIdx = phases.indexOf(c.currentPhase);
                            const phaseIdx = phases.indexOf(phase);
                            return phaseIdx <= currentIdx;
                          })
                          .map((phase) => {
                            const isCurrent = phase === c.currentPhase;
                            return (
                              <div
                                key={phase}
                                className={`flex items-center gap-2 text-sm ${
                                  isCurrent ? "text-foreground font-medium" : "text-muted-foreground"
                                }`}
                              >
                                <div
                                  className={`size-2 rounded-full ${
                                    isCurrent ? "bg-primary" : "bg-muted"
                                  }`}
                                />
                                {PHASE_LABEL[phase] ?? phase}
                                {isCurrent && (
                                  <span className="text-xs text-muted-foreground">
                                    (actual)
                                  </span>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && cases.length > 0 && (
        <p className="text-center text-muted-foreground py-8">
          No hay casos de ese tipo.
        </p>
      )}
    </div>
  );
}
