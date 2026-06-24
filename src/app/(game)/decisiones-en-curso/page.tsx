"use client";

import { useGameStore } from "@/lib/store/game-store";
import Link from "next/link";
import { Clock, CheckCircle2, XCircle, ArrowLeft, AlertTriangle } from "lucide-react";

const FF = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";
const FFM = "var(--font-share-tech-mono,'Share Tech Mono',monospace)";

export default function DecisionesEnCursoPage() {
  const gameState = useGameStore((s) => s.gameState);
  const cancelLongRunningDecision = useGameStore((s) => s.cancelLongRunningDecision);

  if (!gameState) {
    return (
      <div style={{ maxWidth: 1100, fontFamily: FF }}>
        <div style={{ height: 28, background: "#E8E0D8", marginBottom: 18, width: 200 }} />
        <div style={{ height: 400, background: "#E8E0D8", border: "2.5px solid #0A0A0A" }} />
      </div>
    );
  }

  const lrds = gameState.longRunningDecisions ?? [];
  const activeLrds = lrds.filter((d) => d.status === "IN_PROGRESS");
  const completedLrds = lrds.filter((d) => d.status === "COMPLETED");
  const cancelledLrds = lrds.filter((d) => d.status === "CANCELLED");

  const totalActiveCost = activeLrds.reduce((s, d) => s + d.monthlyCost, 0);
  const costLabel =
    totalActiveCost >= 1e9
      ? `M$ ${(totalActiveCost / 1e9).toFixed(1)}B`
      : `M$ ${(totalActiveCost / 1e6).toFixed(0)}M`;

  return (
    <div style={{ maxWidth: 1100, fontFamily: FF }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10,
            fontWeight: 700,
            color: "#888",
            textDecoration: "none",
            letterSpacing: 1,
            marginBottom: 10,
          }}
        >
          <ArrowLeft size={12} /> VOLVER AL DASHBOARD
        </Link>
        <div
          style={{
            background: "#0A0A0A",
            color: "#FFFFFF",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 2.5,
            padding: "4px 12px",
            display: "inline-block",
            marginBottom: 10,
          }}
        >
          GESTIÓN DE PROYECTOS
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 900,
            color: "#0A0A0A",
            letterSpacing: 4,
            marginBottom: 4,
          }}
        >
          DECISIONES EN CURSO
        </div>
        <div style={{ fontSize: 13, color: "#555", fontWeight: 600, letterSpacing: 1 }}>
          AÑO {gameState.currentYear} · MES {gameState.currentMonth}
          {" · "}
          {activeLrds.length} ACTIVAS{" · "}
          COSTO MENSUAL: <span style={{ color: "#FF6600" }}>{costLabel}</span>
        </div>
      </div>

      {/* ACTIVAS */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#0A0A0A",
            letterSpacing: 2,
            marginBottom: 14,
            paddingBottom: 10,
            borderBottom: "2px solid #0A0A0A",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: FF,
          }}
        >
          <Clock size={14} color="#2468CC" />
          EN PROGRESO ({activeLrds.length})
        </div>

        {activeLrds.length === 0 ? (
          <div
            style={{
              padding: 30,
              background: "#FAFAFA",
              border: "2.5px solid #0A0A0A",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 13, color: "#888", fontWeight: 600 }}>
              No hay decisiones en curso.
            </p>
            <p style={{ fontSize: 11, color: "#AAA", fontWeight: 500, marginTop: 4 }}>
              Las decisiones de varios meses apareceran aqui cuando inicies obras, misiones o proyectos.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {activeLrds.map((lrd) => {
              const progress =
                lrd.totalMonths > 0
                  ? ((lrd.totalMonths - lrd.monthsRemaining) / lrd.totalMonths) * 100
                  : 100;
              const isClose = lrd.monthsRemaining <= 2;

              return (
                <div
                  key={lrd.id}
                  style={{
                    background: "#FFFFFF",
                    border: "2.5px solid #0A0A0A",
                    boxShadow: "3px 3px 0 #0A0A0A",
                    padding: 18,
                    borderLeft: `6px solid ${isClose ? "#00C87E" : "#2468CC"}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "#0A0A0A",
                          marginBottom: 4,
                        }}
                      >
                        {lrd.name}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          marginTop: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: "#888",
                            letterSpacing: 1,
                            padding: "2px 6px",
                            background: "#F0F0F0",
                            border: "1px solid #DDD",
                          }}
                        >
                          {lrd.type}
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: "#FF6600",
                            letterSpacing: 1,
                            padding: "2px 6px",
                            background: "#FFF3E0",
                            border: "1px solid #FFE0B2",
                          }}
                        >
                          M$ {(lrd.monthlyCost / 1e6).toFixed(1)}M/mes
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: "#2468CC",
                            letterSpacing: 1,
                            padding: "2px 6px",
                            background: "#E3F2FD",
                            border: "1px solid #BBDEFB",
                          }}
                        >
                          INICIADA: {lrd.startedAt.slice(0, 10)}
                        </span>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      {isClose && (
                        <div
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            color: "#00C87E",
                            letterSpacing: 1,
                            marginBottom: 6,
                            background: "#E8F5E9",
                            padding: "3px 8px",
                            border: "1px solid #A5D6A7",
                          }}
                        >
                          PRÓXIMA A COMPLETAR
                        </div>
                      )}
                      <div
                        style={{
                          fontFamily: FFM,
                          fontSize: 22,
                          fontWeight: 700,
                          color: isClose ? "#00C87E" : "#0A0A0A",
                        }}
                      >
                        {lrd.monthsRemaining} <span style={{ fontSize: 14 }}>/ {lrd.totalMonths}</span>
                      </div>
                      <div style={{ fontSize: 10, color: "#888", fontWeight: 600, marginTop: 2 }}>
                        {Math.round(progress)}% completado
                      </div>
                    </div>
                  </div>

                  {/* Barra de progreso grande */}
                  <div
                    style={{
                      height: 12,
                      background: "#F5F0E8",
                      border: "2px solid #0A0A0A",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, Math.max(0, progress))}%`,
                        background: isClose
                          ? "linear-gradient(90deg, #00C87E, #00E693)"
                          : "linear-gradient(90deg, #2468CC, #3D82EE)",
                      }}
                    />
                  </div>

                  {/* Log de progreso */}
                  {lrd.progressLog && lrd.progressLog.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#888", letterSpacing: 1, marginBottom: 6 }}>
                        REGISTRO DE HITOS
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {lrd.progressLog.slice(-4).map((entry, i) => (
                          <div
                            key={i}
                            style={{
                              fontSize: 10,
                              color: "#555",
                              fontWeight: 500,
                              padding: "2px 0",
                              borderBottom: i < lrd.progressLog.slice(-4).length - 1 ? "1px dotted #EEE" : "none",
                            }}
                          >
                            &bull; {entry}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Botón cancelar */}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => cancelLongRunningDecision(lrd.id)}
                      style={{
                        cursor: "pointer",
                        background: "none",
                        border: "2px solid #FF2090",
                        color: "#FF2090",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "6px 14px",
                        fontFamily: FF,
                        letterSpacing: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <XCircle size={12} />
                      CANCELAR (SE PIERDE LO INVERTIDO)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* COMPLETADAS */}
      {completedLrds.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#0A0A0A",
              letterSpacing: 2,
              marginBottom: 14,
              paddingBottom: 10,
              borderBottom: "2px solid #0A0A0A",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: FF,
            }}
          >
            <CheckCircle2 size={14} color="#00C87E" />
            COMPLETADAS ({completedLrds.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {completedLrds.map((lrd) => (
              <div
                key={lrd.id}
                style={{
                  padding: "12px 14px",
                  border: "2px solid #0A0A0A",
                  borderLeft: "5px solid #00C87E",
                  background: "#FAFAFA",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A" }}>{lrd.name}</span>
                    <span style={{ fontSize: 9, color: "#888", fontWeight: 600, marginLeft: 8 }}>
                      {lrd.type} · {lrd.totalMonths} meses
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: "#00C87E", fontWeight: 700 }}>
                    COMPLETADA: {lrd.completedAt?.slice(0, 10) ?? "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CANCELADAS */}
      {cancelledLrds.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#0A0A0A",
              letterSpacing: 2,
              marginBottom: 14,
              paddingBottom: 10,
              borderBottom: "2px solid #0A0A0A",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: FF,
            }}
          >
            <XCircle size={14} color="#FF2090" />
            CANCELADAS ({cancelledLrds.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cancelledLrds.map((lrd) => (
              <div
                key={lrd.id}
                style={{
                  padding: "12px 14px",
                  border: "2px solid #0A0A0A",
                  borderLeft: "5px solid #FF2090",
                  background: "#FAFAFA",
                  opacity: 0.7,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A" }}>{lrd.name}</span>
                    <span style={{ fontSize: 9, color: "#888", fontWeight: 600, marginLeft: 8 }}>
                      {lrd.type}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: "#FF2090", fontWeight: 700 }}>
                    CANCELADA: {lrd.cancelledAt?.slice(0, 10) ?? "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning si no hay nada */}
      {lrds.length === 0 && (
        <div
          style={{
            padding: 40,
            background: "#FAFAFA",
            border: "2.5px solid #0A0A0A",
            textAlign: "center",
          }}
        >
          <AlertTriangle size={32} color="#E08800" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: "#0A0A0A", marginBottom: 8 }}>
            Sin historial de decisiones
          </p>
          <p style={{ fontSize: 12, color: "#888", fontWeight: 500, lineHeight: 1.6 }}>
            Cuando inicies proyectos, obras o misiones de varios meses,
            apareceran aqui con su progreso detallado y opciones de gestion.
          </p>
        </div>
      )}
    </div>
  );
}
