"use client";

import type { MediaState } from "@/lib/engine/types";
import { useGameStore } from "@/lib/store/game-store";
import { BALANCE } from "@/lib/balance";

const FF = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";

const MEDIA_TYPE_LABELS: Record<string, string> = {
  TV:        "TELEVISIÓN",
  NEWSPAPER: "PERIÓDICO",
  DIGITAL:   "DIGITAL",
};

const MEDIA_TYPE_ICONS: Record<string, string> = {
  TV:        "◉",
  NEWSPAPER: "◎",
  DIGITAL:   "◈",
};

function getAffinityColor(v: number) {
  if (v > 30)  return "#00C87E";
  if (v < -30) return "#FF2090";
  return "#888888";
}

function getAffinityLabel(v: number) {
  if (v > 50)  return "MUY AFÍN";
  if (v > 20)  return "AFÍN";
  if (v > -20) return "NEUTRAL";
  if (v > -50) return "OPOSITOR";
  return "MUY OPOSITOR";
}

function getStatusStyle(status: string): { label: string; bg: string; fg: string } {
  switch (status) {
    case "ACTIVE":   return { label: "ACTIVO",     bg: "#00C87E", fg: "#FFFFFF" };
    case "CENSORED": return { label: "CENSURADO",  bg: "#E08800", fg: "#FFFFFF" };
    case "CLOSED":   return { label: "CLAUSURADO", bg: "#FF2090", fg: "#FFFFFF" };
    default:         return { label: status,       bg: "#888",    fg: "#FFFFFF" };
  }
}

const ACTION_LABELS: Record<string, string> = {
  censor:      "CENSURAR",
  close:       "CLAUSURAR",
  boost:       "IMPULSAR",
  buyAffinity: "COMPRAR AFINIDAD",
  restore:     "RESTAURAR",
};

export default function MediaCard({ medium }: { medium: MediaState }) {
  const setMediaAction = useGameStore((s) => s.setMediaAction);
  const pendingInput   = useGameStore((s) => s.pendingInput);
  const currentAction  = pendingInput.mediaActions?.[medium.id];

  const statusStyle   = getStatusStyle(medium.status);
  const affinityColor = getAffinityColor(medium.governmentAffinity);
  const affinityLabel = getAffinityLabel(medium.governmentAffinity);
  const icon          = MEDIA_TYPE_ICONS[medium.type] ?? "●";
  const typeLabel     = MEDIA_TYPE_LABELS[medium.type] ?? medium.type;

  const affinityPct   = Math.abs(medium.governmentAffinity) / 2;
  const affinityLeft  = medium.governmentAffinity >= 0;

  function Btn({
    action, label, danger,
  }: { action: string; label: string; danger?: boolean }) {
    const active = currentAction === action;
    return (
      <button
        onClick={() => setMediaAction(medium.id, action as Parameters<typeof setMediaAction>[1])}
        disabled={active}
        style={{
          cursor: active ? "default" : "pointer",
          padding: "6px 12px",
          background: active ? (danger ? "#AA1060" : "#008E8A") : danger ? "#FF2090" : "#0A0A0A",
          border: "2px solid #0A0A0A",
          fontFamily: FF,
          fontSize: 10,
          fontWeight: 800,
          color: "#FFFFFF",
          letterSpacing: 1.5,
          opacity: active ? 0.7 : 1,
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "2.5px solid #0A0A0A",
        boxShadow: "4px 4px 0 #0A0A0A",
        padding: 18,
        fontFamily: FF,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Color strip by status */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: statusStyle.bg }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, marginTop: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20, color: "#0A0A0A" }}>{icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0A0A0A", letterSpacing: 0.5 }}>{medium.name}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#888", letterSpacing: 1.5 }}>{typeLabel}</div>
          </div>
        </div>
        <div style={{ background: statusStyle.bg, color: statusStyle.fg, fontSize: 9, fontWeight: 800, letterSpacing: 1.5, padding: "3px 8px" }}>
          {statusStyle.label}
        </div>
      </div>

      {/* Affinity bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: 1.5 }}>AFINIDAD AL GOBIERNO</span>
          <span style={{ fontSize: 9, fontWeight: 800, color: affinityColor, letterSpacing: 1 }}>{affinityLabel}</span>
        </div>
        <div style={{ position: "relative", height: 10, background: "#F5F0E8", border: "2px solid #0A0A0A" }}>
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, background: "#0A0A0A" }} />
          <div
            style={{
              position: "absolute",
              height: "100%",
              width: `${affinityPct}%`,
              background: affinityColor,
              left: affinityLeft ? "50%" : undefined,
              right: affinityLeft ? undefined : "50%",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, fontWeight: 600, color: "#888", marginTop: 2 }}>
          <span>-100</span><span>0</span><span>+100</span>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: 1.5, marginBottom: 5 }}>ALCANCE</div>
          <div style={{ height: 8, background: "#F5F0E8", border: "1.5px solid #0A0A0A", marginBottom: 4 }}>
            <div style={{ height: "100%", width: `${medium.reach}%`, background: "#00C2B8" }} />
          </div>
          <span style={{ fontFamily: "var(--font-share-tech-mono,'Share Tech Mono',monospace)", fontSize: 14, color: "#00C2B8" }}>{medium.reach}/100</span>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: 1.5, marginBottom: 5 }}>CREDIBILIDAD</div>
          <div style={{ height: 8, background: "#F5F0E8", border: "1.5px solid #0A0A0A", marginBottom: 4 }}>
            <div style={{ height: "100%", width: `${medium.credibility}%`, background: "#00C87E" }} />
          </div>
          <span style={{ fontFamily: "var(--font-share-tech-mono,'Share Tech Mono',monospace)", fontSize: 14, color: "#00C87E" }}>{medium.credibility}/100</span>
        </div>
      </div>

      {/* Actions */}
      {medium.status === "ACTIVE" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 10, borderTop: "1.5px solid #E8E0D8" }}>
          <Btn action="censor"      label="CENSURAR" />
          <Btn action="close"       label="CLAUSURAR" danger />
          <Btn action="boost"       label="IMPULSAR" />
          <Btn action="buyAffinity" label="COMPRAR AFINIDAD" />
          {currentAction && currentAction !== "none" && (
            <button
              onClick={() => setMediaAction(medium.id, "none")}
              style={{ cursor: "pointer", padding: "6px 10px", background: "transparent", border: "2px solid rgba(0,0,0,0.2)", fontFamily: FF, fontSize: 10, fontWeight: 700, color: "#888", letterSpacing: 1 }}
            >
              CANCELAR
            </button>
          )}
        </div>
      )}

      {(medium.status === "CENSORED" || medium.status === "CLOSED") && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 10, borderTop: "1.5px solid #E8E0D8" }}>
          <Btn action="restore" label="RESTAURAR MEDIO" />
          {currentAction && currentAction !== "none" && (
            <button
              onClick={() => setMediaAction(medium.id, "none")}
              style={{ cursor: "pointer", padding: "6px 10px", background: "transparent", border: "2px solid rgba(0,0,0,0.2)", fontFamily: FF, fontSize: 10, fontWeight: 700, color: "#888", letterSpacing: 1 }}
            >
              CANCELAR
            </button>
          )}
        </div>
      )}

      {/* Pending badge */}
      {currentAction && currentAction !== "none" && (
        <div style={{ marginTop: 8, padding: "4px 10px", background: "#FFE600", border: "2px solid #0A0A0A", fontSize: 10, fontWeight: 800, color: "#0A0A0A", letterSpacing: 1, display: "inline-block" }}>
          PENDIENTE: {ACTION_LABELS[currentAction] ?? currentAction.toUpperCase()}
        </div>
      )}
    </div>
  );
}
