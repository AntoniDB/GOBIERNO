"use client";

import { useGameStore } from "@/lib/store/game-store";
import Link from "next/link";
import { Clock, CheckCircle2, XCircle } from "lucide-react";

const FF = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";
const FFM = "var(--font-share-tech-mono,'Share Tech Mono',monospace)";

export function LongRunningDecisionsPanel() {
  const gameState = useGameStore((s) => s.gameState);
  const cancelLongRunningDecision = useGameStore((s) => s.cancelLongRunningDecision);

  if (!gameState) return null;

  const activeLrds = (gameState.longRunningDecisions ?? []).filter(
    (d) => d.status === "IN_PROGRESS"
  );

  const completedThisMonth = (gameState.longRunningDecisions ?? []).filter(
    (d) => d.status === "COMPLETED"
  );

  if (activeLrds.length === 0 && completedThisMonth.length === 0) {
    return (
      <div
        style={{
          background: "#FAFAFA",
          border: "2px dashed #CCC",
          padding: 16,
          marginBottom: 16,
          opacity: 0.85,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={13} color="#888" />
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#888",
                letterSpacing: 1.5,
                fontFamily: FF,
              }}
            >
              DECISIONES EN CURSO
            </span>
          </div>
          <div style={{ fontSize: 9, color: "#AAA", fontWeight: 600, fontFamily: FF }}>
            SIN ACTIVIDAD
          </div>
        </div>

        <div
          style={{
            padding: "12px 0 8px",
            borderTop: "1px dashed #DDD",
            borderBottom: "1px dashed #DDD",
            marginBottom: 8,
          }}
        >
          <p style={{ fontSize: 11, color: "#999", fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
            No hay proyectos, obras ni misiones en curso. Aqui apareceran construcciones,
            programas de largo plazo y misiones cuando las inicies desde los ministerios.
          </p>
        </div>

        <Link
          href="/decisiones-en-curso"
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#00C2B8",
            textDecoration: "none",
            letterSpacing: 1,
            fontFamily: FF,
          }}
        >
          EXPLORAR GESTION DE PROYECTOS →
        </Link>
      </div>
    );
  }

  const totalCost = activeLrds.reduce((s, d) => s + d.monthlyCost, 0);
  const costLabel =
    totalCost >= 1e9
      ? `M$ ${(totalCost / 1e9).toFixed(1)}B`
      : `M$ ${(totalCost / 1e6).toFixed(0)}M`;
  const nextToComplete = activeLrds.reduce(
    (min, d) => (d.monthsRemaining < min.monthsRemaining ? d : min),
    activeLrds[0]
  );

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "2.5px solid #0A0A0A",
        boxShadow: "4px 4px 0 #0A0A0A",
        padding: 18,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: "2px solid #0A0A0A",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={14} color="#00C2B8" />
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#0A0A0A",
              letterSpacing: 2,
              fontFamily: FF,
            }}
          >
            DECISIONES EN CURSO
          </span>
          <span
            style={{
              background: "#0A0A0A",
              color: "#FFFFFF",
              fontSize: 9,
              fontWeight: 800,
              padding: "2px 8px",
              marginLeft: 2,
            }}
          >
            {activeLrds.length}
          </span>
        </div>
        <div style={{ fontSize: 10, color: "#555", fontWeight: 600, fontFamily: FF }}>
          COSTO MENSUAL: <span style={{ color: "#FF6600", fontFamily: FFM }}>{costLabel}</span>
        </div>
      </div>

      {activeLrds.length === 0 ? (
        <p style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>
          Sin decisiones en curso.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {activeLrds.slice(0, 3).map((lrd) => {
            const progress = lrd.totalMonths > 0
              ? ((lrd.totalMonths - lrd.monthsRemaining) / lrd.totalMonths) * 100
              : 100;
            const isClose = lrd.monthsRemaining <= 2;

            return (
              <div
                key={lrd.id}
                style={{
                  padding: "10px 12px",
                  border: "2px solid #0A0A0A",
                  borderLeft: `5px solid ${isClose ? "#00C87E" : "#2468CC"}`,
                  background: "#FAFAFA",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A" }}>
                      {lrd.name}
                    </div>
                    <div style={{ fontSize: 9, color: "#888", fontWeight: 600, marginTop: 2 }}>
                      {lrd.type} · M$ {(lrd.monthlyCost / 1e6).toFixed(1)}M/mes
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontFamily: FFM,
                        fontSize: 14,
                        fontWeight: 700,
                        color: isClose ? "#00C87E" : "#0A0A0A",
                      }}
                    >
                      {lrd.monthsRemaining} / {lrd.totalMonths}
                    </div>
                    <div style={{ fontSize: 9, color: "#888", fontWeight: 600 }}>
                      {Math.round(progress)}%
                    </div>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div
                  style={{
                    height: 8,
                    background: "#F5F0E8",
                    border: "1.5px solid #0A0A0A",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, Math.max(0, progress))}%`,
                      background: isClose ? "#00C87E" : "#2468CC",
                    }}
                  />
                </div>

                {/* Boton cancelar */}
                <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => cancelLongRunningDecision(lrd.id)}
                    style={{
                      cursor: "pointer",
                      background: "none",
                      border: "1.5px solid #FF2090",
                      color: "#FF2090",
                      fontSize: 9,
                      fontWeight: 700,
                      padding: "3px 10px",
                      fontFamily: FF,
                      letterSpacing: 1,
                    }}
                  >
                    CANCELAR
                  </button>
                </div>
              </div>
            );
          })}

          {activeLrds.length > 3 && (
            <div style={{ textAlign: "center", marginTop: 4 }}>
              <span style={{ fontSize: 10, color: "#888", fontWeight: 600 }}>
                +{activeLrds.length - 3} más en curso
              </span>
            </div>
          )}
        </div>
      )}

      {/* Completadas recientes */}
      {completedThisMonth.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px dashed #CCC" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <CheckCircle2 size={12} color="#00C87E" />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#00C87E", letterSpacing: 1, fontFamily: FF }}>
              COMPLETADAS RECIENTEMENTE
            </span>
          </div>
          {completedThisMonth.slice(0, 2).map((lrd) => (
            <div key={lrd.id} style={{ fontSize: 11, color: "#555", fontWeight: 600, marginBottom: 3 }}>
              &bull; {lrd.name} — {lrd.totalMonths} meses
            </div>
          ))}
        </div>
      )}

      {/* Link a gestión completa */}
      <div style={{ marginTop: 14, textAlign: "right" }}>
        <Link
          href="/decisiones-en-curso"
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#00C2B8",
            textDecoration: "none",
            letterSpacing: 1,
            fontFamily: FF,
          }}
        >
          GESTIÓN COMPLETA →
        </Link>
      </div>
    </div>
  );
}
