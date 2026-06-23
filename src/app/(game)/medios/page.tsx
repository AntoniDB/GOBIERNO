"use client";

import { useGameStore } from "@/lib/store/game-store";
import MediaCard from "@/components/game/media-card";
import AiNarrative from "@/components/game/ai-narrative";
import { generateCoverageNarrative } from "@/app/actions/ai";

const FF  = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";
const FFM = "var(--font-share-tech-mono,'Share Tech Mono',monospace)";

function getSentimentColor(sentiment: number): string {
  if (sentiment > 0.2)  return "#00C87E";
  if (sentiment < -0.2) return "#FF2090";
  return "#888888";
}

function getSentimentLabel(sentiment: number): string {
  if (sentiment > 0.2)  return "POSITIVO";
  if (sentiment < -0.2) return "NEGATIVO";
  return "NEUTRO";
}

export default function MediosPage() {
  const gameState       = useGameStore((s) => s.gameState);
  const gameId          = useGameStore((s) => s.gameId);
  const lastTurnResult  = useGameStore((s) => s.lastTurnResult);
  const pendingInput    = useGameStore((s) => s.pendingInput);

  if (!gameState) {
    return (
      <div style={{ maxWidth: 1100, fontFamily: FF }}>
        <div style={{ height: 28, background: "#E8E0D8", marginBottom: 18, width: 200 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {[0,1,2].map((i) => (
            <div key={i} style={{ height: 200, background: "#E8E0D8", border: "2.5px solid #0A0A0A" }} />
          ))}
        </div>
      </div>
    );
  }

  const media         = gameState.media;
  const coverages     = lastTurnResult?.mediaCoverages ?? [];
  const polls         = lastTurnResult?.mediaPolls ?? [];
  const pendingActions= pendingInput.mediaActions ?? {};
  const hasPending    = Object.values(pendingActions).some((a) => a !== "none");

  return (
    <div style={{ maxWidth: 1100, fontFamily: FF }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ background: "#0A0A0A", color: "#FFFFFF", fontSize: 9, fontWeight: 700, letterSpacing: 2.5, padding: "4px 12px", display: "inline-block", marginBottom: 10 }}>
          MÓDULO DE MEDIOS
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, color: "#0A0A0A", letterSpacing: 4, marginBottom: 4 }}>
          MEDIOS DE COMUNICACIÓN
        </div>
        <div style={{ fontSize: 13, color: "#555", fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
          {media.length} MEDIOS ACTIVOS
          {hasPending && (
            <span style={{ background: "#FFE600", color: "#0A0A0A", fontSize: 9, fontWeight: 800, letterSpacing: 1.5, padding: "2px 8px", border: "2px solid #0A0A0A" }}>
              CAMBIOS PENDIENTES — AVANZAR MES PARA APLICAR
            </span>
          )}
        </div>
      </div>

      {/* Media cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
        {media.map((medium) => (
          <MediaCard key={medium.id} medium={medium} />
        ))}
      </div>

      {/* Polls */}
      {polls.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              background: "#FFFFFF", border: "2.5px solid #0A0A0A",
              boxShadow: "4px 4px 0 #0A0A0A", padding: 20,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: "#0A0A0A", letterSpacing: 2, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #0A0A0A", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>ENCUESTAS DE OPINIÓN DEL MES</span>
              <span style={{ fontFamily: FFM, fontSize: 14, color: "#00C2B8" }}>{polls.length} ENCUESTAS</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {polls.map((poll) => {
                const affinityColor = poll.governmentAffinity > 30 ? "#00C87E" : poll.governmentAffinity < -30 ? "#FF2090" : "#888";
                const affinityLabel = poll.governmentAffinity > 30 ? "AFÍN" : poll.governmentAffinity < -30 ? "OPOSITOR" : "NEUTRAL";
                return (
                  <div key={poll.mediaId} style={{ padding: 14, border: "2px solid #0A0A0A", background: "#FAFAFA" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A" }}>{poll.mediaName}</span>
                      <span style={{ background: affinityColor, color: "#FFFFFF", fontSize: 8, fontWeight: 800, letterSpacing: 1, padding: "2px 6px" }}>{affinityLabel}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#666", marginBottom: 2 }}>APROBACIÓN</div>
                        <div style={{ fontFamily: FFM, fontSize: 20, color: "#00C2B8" }}>{poll.approvalPoll.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#666", marginBottom: 2 }}>CORRUPCIÓN PERCIBIDA</div>
                        <div style={{ fontFamily: FFM, fontSize: 20, color: "#FF2090" }}>{poll.corruptionPoll.toFixed(1)}%</div>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, fontWeight: 700, color: "#666", marginBottom: 3 }}>
                        <span>CREDIBILIDAD</span>
                        <span>{poll.credibility}/100</span>
                      </div>
                      <div style={{ height: 8, background: "#F5F0E8", border: "1.5px solid #0A0A0A" }}>
                        <div style={{ height: "100%", width: `${poll.credibility}%`, background: "#00C2B8" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Coverages */}
      <div
        style={{
          background: "#FFFFFF", border: "2.5px solid #0A0A0A",
          boxShadow: "4px 4px 0 #0A0A0A", padding: 20,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: "#0A0A0A", letterSpacing: 2, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #0A0A0A", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>COBERTURAS DEL MES</span>
          <span style={{ fontFamily: FFM, fontSize: 14, color: "#00C2B8" }}>{coverages.length} TITULARES</span>
        </div>

        {coverages.length === 0 ? (
          <p style={{ fontSize: 12, fontWeight: 600, color: "#888" }}>No hay coberturas mediáticas este mes.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {coverages.map((coverage, idx) => {
              const medium      = media.find((m) => m.id === coverage.mediaId);
              const mediaName   = medium?.name ?? "Medio desconocido";
              const sColor      = getSentimentColor(coverage.sentiment);
              const sLabel      = getSentimentLabel(coverage.sentiment);

              return (
                <div
                  key={`${coverage.mediaId}-${idx}`}
                  style={{
                    padding: "12px 14px",
                    border: "2px solid #0A0A0A",
                    borderLeft: `6px solid ${sColor}`,
                    background: "#FAFAFA",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#666", letterSpacing: 1 }}>{mediaName.toUpperCase()}</span>
                    <span style={{ background: sColor, color: "#FFFFFF", fontSize: 8, fontWeight: 800, letterSpacing: 1, padding: "2px 6px" }}>
                      {sLabel} ({coverage.sentiment > 0 ? "+" : ""}{coverage.sentiment.toFixed(2)})
                    </span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", lineHeight: 1.4, marginBottom: 8 }}>
                    {coverage.headline}
                  </p>
                  <AiNarrative
                    gameId={gameId ?? ""}
                    entityId={coverage.id}
                    fallbackText={coverage.headline}
                    fetchAction={generateCoverageNarrative}
                    buttonLabel="LEER ARTÍCULO COMPLETO"
                  />
                  {Object.keys(coverage.impactOnApproval).length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                      {Object.entries(coverage.impactOnApproval).map(([clase, impact]) => {
                        const impactColor = impact > 0 ? "#00C87E" : impact < 0 ? "#FF2090" : "#888";
                        const claseLabel  = clase === "EXTREME_POVERTY" ? "Ext. Pobreza" : clase === "POVERTY" ? "Pobreza" : clase === "MIDDLE" ? "Cl. Media" : clase;
                        return (
                          <span
                            key={clase}
                            style={{
                              border: `2px solid ${impactColor}`,
                              fontSize: 9, fontWeight: 700, color: impactColor,
                              padding: "1px 7px", background: "#FAFAFA",
                            }}
                          >
                            {claseLabel}: {impact > 0 ? "+" : ""}{impact.toFixed(2)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
