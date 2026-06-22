"use client";

import { useGameStore } from "@/lib/store/game-store";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import MediaCard from "@/components/game/media-card";
import AiNarrative from "@/components/game/ai-narrative";
import { generateCoverageNarrative } from "@/app/actions/ai";
import { Radio, Newspaper } from "lucide-react";

function getSentimentLabel(sentiment: number): string {
  if (sentiment > 0.2) return "Positivo";
  if (sentiment < -0.2) return "Negativo";
  return "Neutro";
}

function getSentimentColor(sentiment: number): string {
  if (sentiment > 0.2) return "text-accent";
  if (sentiment < -0.2) return "text-destructive";
  return "text-muted-foreground";
}

export default function MediosPage() {
  const gameState = useGameStore((s) => s.gameState);
  const gameId = useGameStore((s) => s.gameId);
  const lastTurnResult = useGameStore((s) => s.lastTurnResult);
  const pendingInput = useGameStore((s) => s.pendingInput);

  if (!gameState) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const media = gameState.media;
  const coverages = lastTurnResult?.mediaCoverages ?? [];
  const polls = lastTurnResult?.mediaPolls ?? [];
  const pendingMediaActions = pendingInput.mediaActions ?? {};
  const hasPendingActions = Object.values(pendingMediaActions).some(
    (a) => a !== "none"
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Radio className="h-6 w-6 text-foreground" />
        <h1 className="text-2xl font-bold text-foreground">Medios de Comunicación</h1>
        {hasPendingActions && (
          <Badge variant="secondary" className="ml-2">
            Cambios pendientes — Avanzar mes para aplicar
          </Badge>
        )}
      </div>

      {/* Tarjetas de medios */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {media.map((medium) => (
          <MediaCard key={medium.id} medium={medium} />
        ))}
      </div>

      {/* Encuestas de opinión */}
      {polls.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">
              Encuestas de opinión del mes
            </h2>
            <Badge variant="outline" className="text-xs">
              {polls.length} encuestas
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {polls.map((poll) => {
              const affinityColor =
                poll.governmentAffinity > 30
                  ? "text-accent"
                  : poll.governmentAffinity < -30
                    ? "text-destructive"
                    : "text-muted-foreground";
              return (
                <Card key={poll.mediaId} size="sm">
                  <CardContent className="flex flex-col gap-3 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        {poll.mediaName}
                      </span>
                      <Badge variant="outline" className={`text-[10px] ${affinityColor}`}>
                        {poll.governmentAffinity > 30
                          ? "Afín"
                          : poll.governmentAffinity < -30
                            ? "Opositor"
                            : "Neutral"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground">
                          Aprobación
                        </span>
                        <div className="text-lg font-bold">
                          {poll.approvalPoll.toFixed(1)}%
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground">
                          Corrupción percibida
                        </span>
                        <div className="text-lg font-bold">
                          {poll.corruptionPoll.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Credibilidad</span>
                        <span>{poll.credibility}/100</span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/50"
                          style={{ width: `${poll.credibility}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Coberturas del mes actual */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">
            Coberturas del mes
          </h2>
          <Badge variant="outline" className="text-xs">
            {coverages.length} titulares
          </Badge>
        </div>

        {coverages.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No hay coberturas mediáticas este mes.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {coverages.map((coverage, idx) => {
              const medium = media.find((m) => m.id === coverage.mediaId);
              const mediaName = medium?.name ?? "Medio desconocido";
              const sentimentLabel = getSentimentLabel(coverage.sentiment);
              const sentimentColor = getSentimentColor(coverage.sentiment);

              return (
                <Card key={`${coverage.mediaId}-${idx}`} size="sm">
                  <CardContent className="flex flex-col gap-2 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">
                        {mediaName}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${sentimentColor}`}
                      >
                        {sentimentLabel} ({coverage.sentiment > 0 ? "+" : ""}
                        {coverage.sentiment.toFixed(2)})
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground">{coverage.headline}</p>
                    <AiNarrative
                      gameId={gameId ?? ""}
                      entityId={coverage.id}
                      fallbackText={coverage.headline}
                      fetchAction={generateCoverageNarrative}
                      buttonLabel="Leer artículo completo"
                    />
                    {/* Impacto en aprobación por clase */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(coverage.impactOnApproval).map(([clase, impact]) => (
                        <Badge
                          key={clase}
                          variant="secondary"
                          className={`text-[10px] ${
                            impact > 0 ? "text-accent" : impact < 0 ? "text-destructive" : ""
                          }`}
                        >
                          {clase === "EXTREME_POVERTY"
                            ? "Ext. Pobreza"
                            : clase === "POVERTY"
                              ? "Pobreza"
                              : clase === "MIDDLE"
                                ? "Cl. Media"
                                : clase}
                          : {impact > 0 ? "+" : ""}
                          {impact.toFixed(2)}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
