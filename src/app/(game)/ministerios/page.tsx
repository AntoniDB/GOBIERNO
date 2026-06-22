"use client";

import { useGameStore } from "@/lib/store/game-store";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { MinistryState } from "@/lib/engine/types";

/* ── Configuración visual ───────────────────────────────────────────────────── */
const MIN_CFG: Record<
  string,
  { abbr: string; name: string; color: string; icon: string }
> = {
  HEALTH:             { abbr: "SAL", name: "Salud Pública",       color: "#00C87E", icon: "♥" },
  EDUCATION:          { abbr: "EDU", name: "Educación",           color: "#E08800", icon: "◎" },
  ECONOMY:            { abbr: "ECO", name: "Economía",            color: "#00C2B8", icon: "◈" },
  DEFENSE:            { abbr: "DEF", name: "Defensa Nacional",    color: "#2468CC", icon: "◆" },
  SECURITY:           { abbr: "SEC", name: "Seguridad Interior",  color: "#FF2090", icon: "⬡" },
  JUSTICE:            { abbr: "JUS", name: "Justicia",            color: "#CC2244", icon: "⚖" },
  AGRICULTURE:        { abbr: "AGR", name: "Agricultura",         color: "#8844CC", icon: "◉" },
  SOCIAL_DEVELOPMENT: { abbr: "DES", name: "Desarrollo Social",  color: "#FF6600", icon: "◇" },
};

const FF  = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";
const FFM = "var(--font-share-tech-mono,'Share Tech Mono',monospace)";

/* ── Helper: barra de progreso ─────────────────────────────────────────────── */
function Bar({ value, color, h = 8 }: { value: number; color: string; h?: number }) {
  return (
    <div style={{ height: h, background: "#F5F0E8", border: "1.5px solid #0A0A0A" }}>
      <div
        style={{
          height: "100%",
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: color,
        }}
      />
    </div>
  );
}

/* ── Tarjeta de ministerio ─────────────────────────────────────────────────── */
function MinCard({
  ministry,
  officials,
  isActive,
  onClick,
}: {
  ministry: MinistryState;
  officials: { id: string; name: string }[];
  isActive: boolean;
  onClick: () => void;
}) {
  const cfg     = MIN_CFG[ministry.key] ?? { abbr: ministry.key.slice(0, 3), name: ministry.key, color: "#888888", icon: "●" };
  const minister = officials.find((o) => o.id === ministry.ministerOfficialId);

  return (
    <div
      onClick={onClick}
      style={{
        background: "#FFFFFF",
        border: `2.5px solid ${isActive ? cfg.color : "#0A0A0A"}`,
        boxShadow: isActive ? `6px 6px 0 ${cfg.color}` : "4px 4px 0 #0A0A0A",
        padding: 18,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* franja superior de color */}
      <div
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 5,
          background: cfg.color,
        }}
      />

      <div style={{ marginTop: 4, marginBottom: 12 }}>
        <div
          style={{
            fontSize: 12, fontWeight: 900, color: cfg.color,
            letterSpacing: 2, marginBottom: 3, fontFamily: FF,
          }}
        >
          {cfg.abbr}
        </div>
        <div
          style={{
            fontSize: 13, fontWeight: 700, color: "#0A0A0A",
            lineHeight: 1.3, marginBottom: 3, fontFamily: FF,
          }}
        >
          {cfg.name}
        </div>
        <div style={{ fontSize: 10, color: "#666", fontWeight: 600, fontFamily: FF }}>
          {minister ? minister.name : "Sin ministro asignado"}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {/* Presupuesto */}
        <div>
          <div
            style={{
              display: "flex", justifyContent: "space-between", marginBottom: 3,
              fontFamily: FF,
            }}
          >
            <span style={{ fontSize: 9, fontWeight: 700, color: "#666" }}>PRESUPUESTO</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#00C2B8" }}>
              {ministry.budgetPercent.toFixed(1)}%
            </span>
          </div>
          <Bar value={ministry.budgetPercent * 2.5} color="#00C2B8" />
        </div>

        {/* Corrupción */}
        <div>
          <div
            style={{
              display: "flex", justifyContent: "space-between", marginBottom: 3,
              fontFamily: FF,
            }}
          >
            <span style={{ fontSize: 9, fontWeight: 700, color: "#666" }}>CORRUPCIÓN</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color }}>
              {ministry.internalCorruption.toFixed(0)}%
            </span>
          </div>
          <Bar value={ministry.internalCorruption} color={cfg.color} />
        </div>

        {/* Eficiencia */}
        <div>
          <div
            style={{
              display: "flex", justifyContent: "space-between", marginBottom: 3,
              fontFamily: FF,
            }}
          >
            <span style={{ fontSize: 9, fontWeight: 700, color: "#666" }}>EFICIENCIA</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#00C87E" }}>
              {ministry.efficiency.toFixed(0)}%
            </span>
          </div>
          <Bar value={ministry.efficiency} color="#00C87E" />
        </div>
      </div>

      <div
        style={{
          marginTop: 12, paddingTop: 10, borderTop: "1.5px solid #E8E0D8",
          fontSize: 10, fontWeight: 600, color: "#888", fontFamily: FF,
          display: "flex", justifyContent: "space-between",
        }}
      >
        <span>PRES: {ministry.budgetPercent.toFixed(1)}%</span>
        <Link
          href={`/ministerios/${ministry.key}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            color: cfg.color, fontWeight: 800, fontSize: 9,
            letterSpacing: 1, textDecoration: "none",
          }}
        >
          DETALLE ▶
        </Link>
      </div>
    </div>
  );
}

/* ── Panel de detalle del ministerio seleccionado ──────────────────────────── */
function MinistryDetail({
  ministry,
  officials,
}: {
  ministry: MinistryState;
  officials: { id: string; name: string }[];
}) {
  const cfg      = MIN_CFG[ministry.key] ?? { abbr: ministry.key.slice(0, 3), name: ministry.key, color: "#888888", icon: "●" };
  const minister = officials.find((o) => o.id === ministry.ministerOfficialId);

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `2.5px solid ${cfg.color}`,
        boxShadow: `4px 4px 0 ${cfg.color}`,
        padding: 24,
        marginTop: 18,
        fontFamily: FF,
      }}
    >
      {/* Cabecera */}
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          marginBottom: 20, paddingBottom: 16, borderBottom: "2px solid #0A0A0A",
        }}
      >
        <div>
          <div
            style={{
              background: cfg.color, color: "#FFFFFF", fontSize: 9, fontWeight: 700,
              letterSpacing: 2, padding: "4px 12px", display: "inline-block", marginBottom: 8,
            }}
          >
            {cfg.abbr}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#0A0A0A", letterSpacing: 2 }}>
            {cfg.name.toUpperCase()}
          </div>
          <div style={{ fontSize: 12, color: "#555", fontWeight: 600, marginTop: 4 }}>
            TITULAR: {minister?.name ?? "Sin ministro asignado"}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, fontWeight: 700, color: "#555", lineHeight: 2 }}>
          <div>PRESUPUESTO: {ministry.budgetPercent.toFixed(1)}%</div>
          <div style={{ color: cfg.color }}>
            CORRUPCIÓN: {ministry.internalCorruption.toFixed(0)}%
          </div>
          <div style={{ color: "#00C87E" }}>
            EFICIENCIA: {ministry.efficiency.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Métricas en 3 columnas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        <MetricBox label="PRESUPUESTO ASIGNADO" value={`${ministry.budgetPercent.toFixed(1)}%`} barVal={ministry.budgetPercent * 2.5} barColor="#00C2B8" />
        <MetricBox label="ÍNDICE CORRUPCIÓN"    value={`${ministry.internalCorruption.toFixed(0)}%`} barVal={ministry.internalCorruption} barColor={cfg.color} />
        <MetricBox label="EFICIENCIA OPERATIVA" value={`${ministry.efficiency.toFixed(0)}%`} barVal={ministry.efficiency} barColor="#00C87E" />
      </div>

      <div style={{ marginTop: 16, textAlign: "right" }}>
        <Link
          href={`/ministerios/${ministry.key}`}
          style={{
            display: "inline-block", padding: "10px 24px",
            background: cfg.color, border: "2.5px solid #0A0A0A",
            boxShadow: "3px 3px 0 #0A0A0A",
            fontFamily: FF, fontWeight: 900, fontSize: 13, letterSpacing: 2,
            color: "#FFFFFF", textDecoration: "none",
          }}
        >
          GESTIONAR MINISTERIO ▶
        </Link>
      </div>
    </div>
  );
}

function MetricBox({
  label,
  value,
  barVal,
  barColor,
}: {
  label: string;
  value: string;
  barVal: number;
  barColor: string;
}) {
  return (
    <div style={{ padding: 16, border: "2px solid #0A0A0A", background: "#FAFAFA", fontFamily: FF }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: 2, marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontFamily: FFM, fontSize: 28, color: barColor, marginBottom: 10 }}>
        {value}
      </div>
      <div style={{ height: 10, background: "#F5F0E8", border: "2px solid #0A0A0A" }}>
        <div style={{ height: "100%", width: `${Math.min(100, barVal)}%`, background: barColor }} />
      </div>
    </div>
  );
}

/* ── Barra de distribución de presupuesto ──────────────────────────────────── */
function BudgetBar({ ministries }: { ministries: MinistryState[] }) {
  const total = useMemo(
    () => ministries.reduce((s, m) => s + m.budgetPercent, 0),
    [ministries]
  );
  const overflow = total > 100 ? total - 100 : 0;

  return (
    <div
      style={{
        background: "#FFFFFF", border: "2.5px solid #0A0A0A",
        boxShadow: "4px 4px 0 #0A0A0A", padding: 20, marginBottom: 18,
        fontFamily: FF,
      }}
    >
      <div
        style={{
          fontSize: 11, fontWeight: 800, color: "#0A0A0A", letterSpacing: 2,
          marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #0A0A0A",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}
      >
        <span>DISTRIBUCIÓN PRESUPUESTARIA</span>
        <span
          style={{
            fontFamily: FFM, fontSize: 16,
            color: overflow > 0 ? "#FF2090" : "#00C87E",
          }}
        >
          {total.toFixed(1)}%
        </span>
      </div>

      {/* Barra segmentada */}
      <div
        style={{
          height: 32, display: "flex", border: "2.5px solid #0A0A0A",
          overflow: "hidden", marginBottom: 12,
        }}
      >
        {ministries.map((m) => {
          if (m.budgetPercent <= 0) return null;
          const cfg = MIN_CFG[m.key] ?? { color: "#888888" };
          return (
            <div
              key={m.key}
              title={`${MIN_CFG[m.key]?.abbr ?? m.key}: ${m.budgetPercent.toFixed(1)}%`}
              style={{
                height: "100%",
                width: `${m.budgetPercent}%`,
                background: cfg.color,
                borderRight: "1px solid rgba(0,0,0,0.2)",
                flexShrink: 0,
              }}
            />
          );
        })}
        {total < 100 && (
          <div
            style={{
              height: "100%", flex: 1,
              background: "rgba(0,0,0,0.07)",
            }}
          />
        )}
      </div>

      {/* Leyenda */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {ministries.map((m) => {
          const cfg = MIN_CFG[m.key] ?? { abbr: m.key.slice(0, 3), color: "#888888" };
          return (
            <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, background: cfg.color, border: "1.5px solid #0A0A0A" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#555" }}>
                {cfg.abbr} {m.budgetPercent.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>

      {overflow > 0 && (
        <div
          style={{
            marginTop: 12, padding: "8px 14px",
            border: "2px solid #FF2090", background: "rgba(255,32,144,0.06)",
            fontSize: 11, fontWeight: 700, color: "#FF2090", letterSpacing: 1,
          }}
        >
          ⚠ DÉFICIT PRESUPUESTARIO: +{overflow.toFixed(1)}% — Ajusta los ministerios marcados
        </div>
      )}
    </div>
  );
}

/* ── Página ─────────────────────────────────────────────────────────────────── */
export default function MinisteriosPage() {
  const gameState = useGameStore((s) => s.gameState);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const ministries = gameState?.ministries ?? [];
  const officials  = gameState?.officials  ?? [];

  const activeMinistry = activeKey
    ? ministries.find((m) => m.key === activeKey) ?? null
    : null;

  return (
    <div style={{ maxWidth: 1100, fontFamily: FF }}>
      {/* ─── Cabecera ─── */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            background: "#0A0A0A", color: "#FFFFFF", fontSize: 9, fontWeight: 700,
            letterSpacing: 2.5, padding: "4px 12px", display: "inline-block", marginBottom: 10,
          }}
        >
          MÓDULO EJECUTIVO
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, color: "#0A0A0A", letterSpacing: 4, marginBottom: 4 }}>
          MINISTERIOS
        </div>
        <div style={{ fontSize: 13, color: "#555", fontWeight: 600 }}>
          {ministries.length} MINISTERIOS ACTIVOS · CLIC PARA DETALLE
        </div>
      </div>

      {/* ─── Sin datos ─── */}
      {!gameState ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              style={{
                height: 180, background: "#E8E0D8",
                border: "2.5px solid #0A0A0A",
              }}
            />
          ))}
        </div>
      ) : (
        <>
          <BudgetBar ministries={ministries} />

          {/* Grid de tarjetas */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 0 }}>
            {ministries.map((m) => (
              <MinCard
                key={m.id}
                ministry={m}
                officials={officials}
                isActive={m.key === activeKey}
                onClick={() => setActiveKey(m.key === activeKey ? null : m.key)}
              />
            ))}
          </div>

          {/* Panel de detalle */}
          {activeMinistry && (
            <MinistryDetail ministry={activeMinistry} officials={officials} />
          )}
        </>
      )}
    </div>
  );
}
