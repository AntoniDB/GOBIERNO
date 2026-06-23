"use client";

import { useState } from "react";
import type { LawCatalogEntry, SenatorState, PartyState } from "@/lib/engine/types";
import { LawProposalModal } from "./law-proposal-modal";

const FF  = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";
const FFM = "var(--font-share-tech-mono,'Share Tech Mono',monospace)";

export function LawCatalogLoading() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ background: "#FFFFFF", border: "2.5px solid #0A0A0A", boxShadow: "4px 4px 0 #0A0A0A", padding: 20 }}>
          <div style={{ height: 20, background: "#E8E0D8", marginBottom: 8 }} />
          <div style={{ height: 14, background: "#E8E0D8", marginBottom: 6 }} />
          <div style={{ height: 14, background: "#E8E0D8", width: "80%", marginBottom: 16 }} />
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            <div style={{ height: 10, width: 60, background: "#E8E0D8" }} />
            <div style={{ height: 10, width: 60, background: "#E8E0D8" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ height: 14, width: 60, background: "#E8E0D8" }} />
            <div style={{ height: 28, width: 80, background: "#E8E0D8" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function IdeologyBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(-100, Math.min(100, value));
  const isPositive = clamped >= 0;
  const barColor = isPositive ? "#00C87E" : "#2468CC";
  const barWidth = Math.abs(clamped) / 2;
  const barLeft = isPositive ? "50%" : `${50 - barWidth}%`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontFamily: FFM, fontSize: 9, color: "#666", width: 40, textAlign: "right", flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 8, background: "#F5F0E8", border: "1.5px solid #0A0A0A", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: "50%", width: 1, height: "100%", background: "#0A0A0A", zIndex: 1 }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: barLeft,
            width: `${barWidth}%`,
            height: "100%",
            background: barColor,
          }}
        />
      </div>
      <span style={{ fontFamily: FFM, fontSize: 9, color: "#666", width: 28, flexShrink: 0 }}>
        {clamped > 0 ? "+" : ""}{clamped}
      </span>
    </div>
  );
}

function getClassLabel(key: string): string {
  const map: Record<string, string> = {
    EXTREME_POVERTY: "Extrema",
    POVERTY: "Pobre",
    MIDDLE: "Media",
    ELITE: "Élite",
  };
  return map[key] ?? key;
}

function EffectBadge({ label, positive }: { label: string; positive: boolean }) {
  return (
    <span style={{
      background: positive ? "#00C87E" : "#FF2090",
      color: positive ? "#0A0A0A" : "#FFFFFF",
      fontSize: 9,
      fontWeight: 800,
      fontFamily: FFM,
      letterSpacing: 0.5,
      padding: "2px 6px",
      border: `1.5px solid ${positive ? "#008855" : "#CC0066"}`,
    }}>
      {label}
    </span>
  );
}

export function LawCatalog({
  laws,
  proposedLaws,
  activeLaws,
  onPropose,
  senators,
  parties,
  approval,
}: {
  laws: LawCatalogEntry[];
  proposedLaws: string[];
  activeLaws: string[];
  onPropose: (lawKey: string) => void;
  senators: SenatorState[];
  parties: PartyState[];
  approval: number;
}) {
  const [search, setSearch] = useState("");
  const [modalLaw, setModalLaw] = useState<LawCatalogEntry | null>(null);

  const filtered = laws.filter((law) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return law.name.toLowerCase().includes(q) || law.description.toLowerCase().includes(q);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Search */}
      <div style={{ position: "relative" }}>
        <span style={{
          position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
          fontFamily: FFM, fontSize: 12, color: "#666", pointerEvents: "none",
        }}>⌕</span>
        <input
          placeholder="Buscar leyes por nombre o descripción..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px 10px 32px",
            background: "#FFFFFF",
            border: "2px solid #0A0A0A",
            fontFamily: FF,
            fontSize: 13,
            fontWeight: 600,
            color: "#0A0A0A",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {filtered.map((law) => {
          const isProposed = proposedLaws.includes(law.key);
          const isActive = activeLaws.includes(law.key);

          const effects = law.effectsJson;
          const badges: { label: string; positive: boolean }[] = [];
          for (const [key, val] of Object.entries(effects)) {
            if (key === "approval" && typeof val === "object" && val !== null) {
              for (const [cls, change] of Object.entries(val as Record<string, number>)) {
                if (change === 0) continue;
                badges.push({ label: `${getClassLabel(cls)}: ${change > 0 ? "+" : ""}${change}`, positive: change > 0 });
              }
            } else if (typeof val === "number" && val !== 0 && key !== "cost") {
              badges.push({ label: `${key}: ${val > 0 ? "+" : ""}${val}`, positive: val > 0 });
            }
          }

          return (
            <div
              key={law.key}
              style={{
                background: "#FFFFFF",
                border: "2.5px solid #0A0A0A",
                boxShadow: "4px 4px 0 #0A0A0A",
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                opacity: isActive ? 0.65 : 1,
              }}
            >
              {/* Name & description */}
              <div>
                <div style={{ fontFamily: FF, fontSize: 16, fontWeight: 900, color: "#0A0A0A", letterSpacing: 1, marginBottom: 4 }}>
                  {law.name}
                </div>
                <div style={{ fontFamily: FF, fontSize: 12, color: "#555", lineHeight: 1.4,
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {law.description}
                </div>
              </div>

              {/* Ideology bars */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <IdeologyBar value={law.idealIdeology.economic}  label="ECON" />
                <IdeologyBar value={law.idealIdeology.social}    label="SOC" />
                <IdeologyBar value={law.idealIdeology.authority} label="AUT" />
              </div>

              {/* Effect badges */}
              {badges.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {badges.map((b, i) => <EffectBadge key={i} label={b.label} positive={b.positive} />)}
                </div>
              )}

              {/* Footer */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 4, borderTop: "1.5px solid #E8E0D8" }}>
                <span style={{ fontFamily: FFM, fontSize: 11, color: "#666" }}>
                  {law.cost <= 0 ? "SIN COSTO" : `M$ ${(law.cost / 1_000_000).toFixed(0)}`}
                </span>
                {isActive ? (
                  <span style={{
                    background: "#00C87E", color: "#0A0A0A",
                    fontSize: 9, fontWeight: 800, fontFamily: FFM, letterSpacing: 1.5,
                    padding: "4px 10px", border: "1.5px solid #008855",
                  }}>
                    ◈ ACTIVA
                  </span>
                ) : isProposed ? (
                  <span style={{
                    background: "#FFE600", color: "#0A0A0A",
                    fontSize: 9, fontWeight: 800, fontFamily: FFM, letterSpacing: 1.5,
                    padding: "4px 10px", border: "1.5px solid #CC8800",
                  }}>
                    ◎ PROPUESTA
                  </span>
                ) : (
                  <button
                    onClick={() => setModalLaw(law)}
                    style={{
                      background: "#00C2B8", border: "2px solid #0A0A0A", boxShadow: "2px 2px 0 #0A0A0A",
                      padding: "6px 14px", fontFamily: FF, fontWeight: 900, fontSize: 11,
                      letterSpacing: 1.5, color: "#0A0A0A", cursor: "pointer",
                    }}
                  >
                    + PROPONER
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", fontFamily: FF, color: "#666", fontSize: 14, padding: "32px 0" }}>
          No se encontraron leyes con ese criterio de búsqueda.
        </div>
      )}

      {modalLaw && (
        <LawProposalModal
          open={!!modalLaw}
          onClose={() => setModalLaw(null)}
          lawKey={modalLaw.key}
          lawName={modalLaw.name}
          lawDescription={modalLaw.description}
          senators={senators}
          parties={parties}
          approval={approval}
          onConfirm={() => {
            onPropose(modalLaw.key);
            setModalLaw(null);
          }}
        />
      )}
    </div>
  );
}
