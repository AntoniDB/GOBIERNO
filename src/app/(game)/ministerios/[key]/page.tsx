"use client";

import { useParams } from "next/navigation";
import { useGameStore } from "@/lib/store/game-store";
import { MinistryView } from "@/components/game/ministry-view";
import Link from "next/link";

const FF = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";

const MINISTRY_CFG: Record<string, { name: string; abbr: string; color: string }> = {
  HEALTH:             { name: "SALUD PÚBLICA",    abbr: "SAL", color: "#00C87E" },
  EDUCATION:          { name: "EDUCACIÓN",         abbr: "EDU", color: "#E08800" },
  ECONOMY:            { name: "ECONOMÍA",          abbr: "ECO", color: "#00C2B8" },
  DEFENSE:            { name: "DEFENSA NACIONAL",  abbr: "DEF", color: "#2468CC" },
  SECURITY:           { name: "SEGURIDAD INTERIOR",abbr: "SEC", color: "#FF2090" },
  JUSTICE:            { name: "JUSTICIA",          abbr: "JUS", color: "#CC2244" },
  AGRICULTURE:        { name: "AGRICULTURA",       abbr: "AGR", color: "#8844CC" },
  SOCIAL_DEVELOPMENT: { name: "DESARROLLO SOCIAL", abbr: "DES", color: "#FF6600" },
};

export default function MinistryDetailPage() {
  const params    = useParams();
  const key       = params.key as string;
  const gameState = useGameStore((s) => s.gameState);

  const cfg = MINISTRY_CFG[key] ?? { name: key.toUpperCase(), abbr: key.slice(0, 3).toUpperCase(), color: "#888888" };

  if (!gameState) {
    return (
      <div style={{ maxWidth: 1100, fontFamily: FF }}>
        <div style={{ height: 24, background: "#E8E0D8", width: 300, marginBottom: 20 }} />
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ flex: 1, height: 400, background: "#E8E0D8", border: "2.5px solid #0A0A0A" }} />
          <div style={{ width: 280, height: 300, background: "#E8E0D8", border: "2.5px solid #0A0A0A" }} />
        </div>
      </div>
    );
  }

  const ministry = gameState.ministries.find((m) => m.key === key);

  if (!ministry) {
    return (
      <div style={{ maxWidth: 1100, fontFamily: FF, display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ background: "#FF2090", color: "#FFFFFF", fontSize: 9, fontWeight: 700, letterSpacing: 2, padding: "4px 12px", display: "inline-block", marginBottom: 10 }}>
            ERROR
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0A0A0A" }}>MINISTERIO NO ENCONTRADO</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, fontFamily: FF }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, fontWeight: 700, color: "#888", letterSpacing: 1, marginBottom: 20 }}>
        <Link href="/dashboard" style={{ color: "#888", textDecoration: "none" }}>DASHBOARD</Link>
        <span>▶</span>
        <Link href="/ministerios" style={{ color: "#888", textDecoration: "none" }}>MINISTERIOS</Link>
        <span>▶</span>
        <span style={{ color: cfg.color }}>{cfg.abbr}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ background: cfg.color, color: "#FFFFFF", fontSize: 9, fontWeight: 700, letterSpacing: 2.5, padding: "4px 12px", display: "inline-block", marginBottom: 10 }}>
          MÓDULO EJECUTIVO · {cfg.abbr}
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, color: "#0A0A0A", letterSpacing: 4, marginBottom: 4 }}>
          {cfg.name}
        </div>
      </div>

      <MinistryView ministry={ministry} />
    </div>
  );
}
