"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store/game-store";
import { getGameState, getSnapshots } from "@/app/actions/game";
import { getDemoGameId } from "@/app/actions/demo";
import Link from "next/link";

/* ── Colores de ministerios ─────────────────────────────────────────────────── */
const MIN_CFG: Record<string, { abbr: string; color: string }> = {
  HEALTH:             { abbr: "SAL", color: "#00C87E" },
  EDUCATION:          { abbr: "EDU", color: "#E08800" },
  ECONOMY:            { abbr: "ECO", color: "#00C2B8" },
  DEFENSE:            { abbr: "DEF", color: "#2468CC" },
  SECURITY:           { abbr: "SEC", color: "#FF2090" },
  JUSTICE:            { abbr: "JUS", color: "#CC2244" },
  AGRICULTURE:        { abbr: "AGR", color: "#8844CC" },
  SOCIAL_DEVELOPMENT: { abbr: "DES", color: "#FF6600" },
};

/* ── Clases sociales ─────────────────────────────────────────────────────────── */
const CLASS_CFG: Record<string, { name: string; color: string }> = {
  ELITE:          { name: "ÉLITE",          color: "#E08800" },
  MIDDLE:         { name: "CLASE MEDIA",    color: "#2468CC" },
  POVERTY:        { name: "CLASE BAJA",     color: "#FF6600" },
  EXTREME_POVERTY:{ name: "POBREZA EXTREMA",color: "#FF2090" },
};

const PARTY_COLORS = [
  "#2468CC", "#CC2222", "#8844CC", "#E08800",
  "#FF6600", "#00C87E", "#668888",
];

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
function valueColor(v: number, inverse = false) {
  if (inverse) {
    if (v < 25) return "#00C87E";
    if (v < 50) return "#E08800";
    return "#FF2090";
  }
  if (v > 60) return "#00C87E";
  if (v > 35) return "#E08800";
  return "#FF2090";
}

function riskLabel(t: number) {
  if (t < 20) return "MÍNIMO";
  if (t < 40) return "BAJO";
  if (t < 60) return "MEDIO";
  if (t < 80) return "ALTO";
  return "CRÍTICO";
}

function riskColor(t: number) {
  if (t < 20) return "#00C87E";
  if (t < 40) return "#2468CC";
  if (t < 60) return "#E08800";
  if (t < 80) return "#FF6600";
  return "#FF2090";
}

function eventColor(type: string) {
  switch (type) {
    case "CRISIS":    return "#FF2090";
    case "SCANDAL":   return "#FF6600";
    case "PROTEST":   return "#E08800";
    case "ECONOMIC":  return "#00C2B8";
    default:          return "#8844CC";
  }
}

/* ── Sub-componentes ─────────────────────────────────────────────────────────── */
const FF  = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";
const FFM = "var(--font-share-tech-mono,'Share Tech Mono',monospace)";

function Bar({ value, color, h = 10 }: { value: number; color: string; h?: number }) {
  return (
    <div style={{ height: h, background: "#F5F0E8", border: "2px solid #0A0A0A" }}>
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

function MiniIndicatorCard({
  label,
  value,
  color,
  suffix = "%",
}: {
  label: string;
  value: number;
  color: string;
  suffix?: string;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "2.5px solid #0A0A0A",
        boxShadow: "3px 3px 0 #0A0A0A",
        padding: 12,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: color,
        }}
      />
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: "#666",
          letterSpacing: 1.5,
          marginBottom: 8,
          marginTop: 2,
          fontFamily: FF,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: FFM,
          fontSize: 26,
          color: "#0A0A0A",
          lineHeight: 1,
        }}
      >
        {value.toFixed(1)}
        <span style={{ fontSize: 12 }}>{suffix}</span>
      </div>
      <div
        style={{
          marginTop: 8,
          height: 6,
          background: "#F5F0E8",
          border: "1.5px solid #0A0A0A",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.min(100, Math.max(0, value))}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

function SectionTitle({ label, badge }: { label: string; badge?: string }) {
  return (
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
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: FF,
      }}
    >
      <span>{label}</span>
      {badge && (
        <span
          style={{
            background: "#FF2090",
            color: "#FFFFFF",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: 1,
            padding: "2px 8px",
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function Card({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "2.5px solid #0A0A0A",
        boxShadow: `4px 4px 0 ${accent ?? "#0A0A0A"}`,
        padding: 20,
      }}
    >
      {children}
    </div>
  );
}

/* ── Página principal ────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const gameState   = useGameStore((s) => s.gameState);
  const setGameState= useGameStore((s) => s.setGameState);
  const setGameId   = useGameStore((s) => s.setGameId);
  const setSnapshots= useGameStore((s) => s.setSnapshots);
  const lastTurn    = useGameStore((s) => s.lastTurnResult);
  const [loaded, setLoaded] = useState(false);
  const [noGames, setNoGames] = useState(false);

  useEffect(() => {
    getDemoGameId().then((id) => {
      if (!id) { setLoaded(true); setNoGames(true); return; }
      setGameId(id);
      Promise.all([getGameState(id), getSnapshots(id)]).then(([state, snaps]) => {
        if (state) setGameState(state);
        if (snaps)  setSnapshots(snaps);
        setLoaded(true);
      });
    });
  }, [setGameId, setGameState, setSnapshots]);

  /* ── Indicadores ── */
  const snap       = lastTurn?.monthSnapshot;
  const approval   = Math.round(snap?.approval   ?? 50);
  const corruption = Math.round(snap?.corruption ?? 30);
  const stability  = (() => {
    if (!gameState?.regimeMetrics) return 50;
    const m = gameState.regimeMetrics;
    return Math.round(
      (m.politicalPluralism + m.civilLiberties + m.transparency +
       m.judicialIndependence + m.pressFreedom) / 5
    );
  })();

  /* ── Carga ── */
  if (!loaded) {
    return (
      <div style={{ maxWidth: 1100, fontFamily: FF }}>
        <div style={{ height: 28, background: "#E8E0D8", marginBottom: 18, width: 240 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
          {[0,1,2,3].map((i) => (
            <div key={i} style={{ height: 120, background: "#E8E0D8", border: "2.5px solid #0A0A0A" }} />
          ))}
        </div>
      </div>
    );
  }

  /* ── Sin partidas ── */
  if (noGames || !gameState) {
    return (
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: "60vh", fontFamily: FF,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ background: "#0A0A0A", color: "#FFFFFF", fontSize: 9, fontWeight: 700, letterSpacing: 2.5, padding: "4px 12px", display: "inline-block", marginBottom: 12 }}>
            GOV.OS
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#0A0A0A", letterSpacing: 4, marginBottom: 8 }}>
            SIN PARTIDAS ACTIVAS
          </div>
          <p style={{ fontSize: 13, color: "#666", fontWeight: 600, marginBottom: 20 }}>
            No hay ninguna partida en curso. Crea una nueva para empezar a gobernar.
          </p>
          <Link
            href="/nueva-partida"
            style={{
              display: "inline-block", padding: "12px 32px",
              background: "#00C2B8", border: "2.5px solid #0A0A0A",
              boxShadow: "4px 4px 0 #0A0A0A",
              fontFamily: FF, fontWeight: 900, fontSize: 14, letterSpacing: 3,
              color: "#0A0A0A", textDecoration: "none",
            }}
          >
            ▶ NUEVA PARTIDA
          </Link>
        </div>
      </div>
    );
  }

  /* ── Datos ── */
  const parties       = gameState.parties  ?? [];
  const ministries    = gameState.ministries ?? [];
  const socialClasses = gameState.socialClasses ?? [];
  const events        = gameState.events ?? [];
  const activeAlerts  = events.filter((e) => !e.resolvedAt).slice(0, 5);
  const totalSeats    = parties.reduce((s, p) => s + (p.seatsLower ?? 0), 0) || 1;
  const gdpRaw        = gameState.gdp ?? 0;
  const gdpLabel      = gdpRaw >= 1e12 ? `${(gdpRaw/1e12).toFixed(2)}T` : `${(gdpRaw/1e9).toFixed(1)}B`;
  const treasuryRaw   = gameState.treasury ?? 0;
  const treasuryLabel = treasuryRaw >= 1e9
    ? `${(treasuryRaw / 1e9).toFixed(1)}B`
    : `${(treasuryRaw / 1e6).toFixed(0)}M`;
  const giniVal       = snap?.gini ?? 0;
  const regimeLabel   = snap?.regimeType ?? "—";
  const regimeColorVal = regimeLabel.includes("plena")
    ? "#00C87E"
    : regimeLabel.includes("defectuosa")
    ? "#2468CC"
    : regimeLabel.includes("híbrido") || regimeLabel.includes("hibrido")
    ? "#E08800"
    : regimeLabel.includes("Autoritarismo")
    ? "#FF6600"
    : regimeLabel.includes("Dictadura")
    ? "#FF2090"
    : regimeLabel.includes("fallido")
    ? "#CC2244"
    : "#888888";

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
          GOV.OS · {gameState.countryName?.toUpperCase()}
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, color: "#0A0A0A", letterSpacing: 4, marginBottom: 4 }}>
          PANEL DE CONTROL
        </div>
        <div style={{ fontSize: 13, color: "#555", fontWeight: 600, letterSpacing: 1 }}>
          AÑO {gameState.currentYear} · MES {gameState.currentMonth} · POBLACIÓN{" "}
          {(gameState.population / 1e6).toFixed(1)}M
        </div>
      </div>

      {/* ─── 4 tarjetas de indicadores ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 18 }}>
        <IndicatorCard label="APROBACIÓN PRES." value={approval} color={valueColor(approval)} />
        <IndicatorCard label="ESTABILIDAD"      value={stability} color={valueColor(stability)} />

        {/* PIB — tarjeta oscura */}
        <div
          style={{
            background: "#0A0A0A", border: "2.5px solid #0A0A0A",
            boxShadow: "4px 4px 0 #00C2B8", padding: 18, position: "relative",
          }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: "#00C2B8" }} />
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 2, marginBottom: 10, marginTop: 2 }}>
            PIB NACIONAL
          </div>
          <div style={{ fontFamily: FFM, fontSize: 34, color: "#00C2B8", lineHeight: 1 }}>
            {gdpLabel}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 6, fontWeight: 600 }}>
            AKN
          </div>
        </div>

        <IndicatorCard label="CORRUPCIÓN SIS." value={corruption} color={valueColor(corruption, true)} />
      </div>

      {/* ─── Indicadores Sociales ─── */}
      <div style={{ marginBottom: 18 }}>
        <SectionTitle label="INDICADORES SOCIALES" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 12 }}>
          <MiniIndicatorCard label="POBREZA" value={gameState.povertyRate} color={valueColor(gameState.povertyRate, true)} />
          <MiniIndicatorCard label="CRIMINALIDAD" value={gameState.crimeRate} color={valueColor(gameState.crimeRate, true)} />
          <MiniIndicatorCard label="ENFERMOS" value={gameState.sickRate} color={valueColor(gameState.sickRate, true)} />
          <MiniIndicatorCard label="SEG. ALIMENTARIA" value={gameState.foodSecurity} color={valueColor(gameState.foodSecurity)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 12 }}>
          <MiniIndicatorCard label="EDUCACIÓN" value={gameState.educationLevel} color={valueColor(gameState.educationLevel)} />
          <MiniIndicatorCard label="DESIGUALDAD (GINI)" value={giniVal} color={valueColor(giniVal, true)} suffix="" />
          <MiniIndicatorCard label="INFLACIÓN" value={gameState.inflation} color={valueColor(gameState.inflation, true)} />
          <MiniIndicatorCard label="DESEMPLEO" value={gameState.unemploymentRate} color={valueColor(gameState.unemploymentRate, true)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          <MiniIndicatorCard label="ESP. DE VIDA" value={gameState.lifeExpectancy ?? 68} color={valueColor(gameState.lifeExpectancy ?? 68)} suffix="a" />
        </div>
      </div>

      {/* ─── Tesoro + Régimen ─── */}
      <div style={{ marginBottom: 18 }}>
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: 2, marginBottom: 6 }}>
                TESORO PÚBLICO
              </div>
              <div style={{ fontFamily: FFM, fontSize: 24, color: "#0A0A0A", fontWeight: 700, lineHeight: 1 }}>
                {treasuryLabel} <span style={{ fontSize: 13, fontWeight: 600, color: "#888" }}>AKN</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: 2, marginBottom: 6 }}>
                TIPO DE RÉGIMEN
              </div>
              <div style={{ fontFamily: FFM, fontSize: 20, color: regimeColorVal, fontWeight: 700, lineHeight: 1.2, letterSpacing: 1 }}>
                {regimeLabel}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Tensión social + Alertas ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
        {/* Tensión */}
        <Card>
          <SectionTitle label="TENSIÓN SOCIAL POR CLASE" />
          {socialClasses.length === 0 ? (
            <p style={{ fontSize: 12, color: "#888" }}>Sin datos.</p>
          ) : (
            socialClasses.map((cls) => {
              const cfg     = CLASS_CFG[cls.key] ?? { name: cls.key, color: "#888" };
              const tension = Math.round(100 - cls.approval);
              const rc      = riskColor(tension);
              return (
                <div key={cls.id} style={{ marginBottom: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#0A0A0A" }}>{cfg.name}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, color: "#555", fontWeight: 600 }}>{tension}%</span>
                      <span style={{ fontSize: 9, color: "#FFFFFF", background: rc, padding: "1px 6px", fontWeight: 700, letterSpacing: 1 }}>
                        {riskLabel(tension)}
                      </span>
                    </div>
                  </div>
                  <Bar value={tension} color={rc} />
                </div>
              );
            })
          )}
        </Card>

        {/* Alertas */}
        <Card>
          <SectionTitle
            label="ALERTAS ACTIVAS"
            badge={activeAlerts.length > 0 ? `${activeAlerts.length} PENDIENTES` : undefined}
          />
          {activeAlerts.length === 0 ? (
            <p style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>
              Sin alertas activas — situación bajo control.
            </p>
          ) : (
            activeAlerts.map((ev) => {
              const ec = eventColor(ev.type);
              return (
                <div
                  key={ev.id}
                  style={{
                    padding: "10px 12px", border: "2px solid #0A0A0A",
                    borderLeft: `6px solid ${ec}`, marginBottom: 10, background: "#FAFAFA",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ background: ec, color: "#FFFFFF", fontSize: 8, fontWeight: 800, letterSpacing: 1.5, padding: "2px 7px" }}>
                      {ev.type}
                    </div>
                    <span style={{ fontSize: 9, color: "#888", fontWeight: 600 }}>
                      {ev.year}/{ev.month}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A", lineHeight: 1.4 }}>
                    {ev.description.length > 70
                      ? ev.description.slice(0, 70) + "…"
                      : ev.description}
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </div>

      {/* ─── Barra parlamentaria ─── */}
      <Card>
        <SectionTitle label={`BALANCE PARLAMENTARIO — ${totalSeats} ESCAÑOS`} />
        {/* Barra segmentada */}
        <div
          style={{
            height: 36, display: "flex", border: "2.5px solid #0A0A0A",
            overflow: "hidden", marginBottom: 12,
          }}
        >
          {parties.map((p, i) => {
            const seats = p.seatsLower ?? 0;
            const pct   = (seats / totalSeats) * 100;
            const color = PARTY_COLORS[i % PARTY_COLORS.length];
            const abbr  = p.name.slice(0, 3).toUpperCase();
            return (
              <div
                key={p.id}
                style={{
                  height: "100%", width: `${pct}%`,
                  background: color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRight: "1px solid rgba(0,0,0,0.25)",
                  flexShrink: 0,
                }}
              >
                {pct > 6 && (
                  <span style={{ fontSize: 9, color: "#FFFFFF", fontWeight: 900, letterSpacing: 0.5 }}>
                    {abbr}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {/* Leyenda */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {parties.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 12, height: 12,
                  background: PARTY_COLORS[i % PARTY_COLORS.length],
                  border: "1.5px solid #0A0A0A",
                }}
              />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#0A0A0A" }}>
                {p.name.length > 16 ? p.name.slice(0, 16) + "…" : p.name} · {p.seatsLower ?? 0}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ marginTop: 18 }}>
        {/* ─── Mini-grid ministerios ─── */}
        <Card>
          <SectionTitle label="ESTADO MINISTERIOS" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {ministries.map((m) => {
              const cfg = MIN_CFG[m.key] ?? { abbr: m.key.slice(0, 3), color: "#888888" };
              return (
                <Link key={m.id} href={`/ministerios/${m.key}`} style={{ textDecoration: "none" }}>
                  <div
                    style={{
                      padding: 12, border: "2px solid #0A0A0A",
                      background: "#FAFAFA", cursor: "pointer", position: "relative",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute", top: 0, left: 0, right: 0, height: 4,
                        background: cfg.color,
                      }}
                    />
                    <div
                      style={{
                        fontSize: 12, fontWeight: 900, color: cfg.color,
                        letterSpacing: 1.5, marginTop: 6, marginBottom: 5,
                      }}
                    >
                      {cfg.abbr}
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: "#555", marginBottom: 5 }}>
                      CORR. {m.internalCorruption.toFixed(0)}%
                    </div>
                    <Bar value={m.internalCorruption} color={cfg.color} h={8} />
                    <div style={{ fontSize: 9, color: "#888", marginTop: 5, fontWeight: 600 }}>
                      EFI: {m.efficiency.toFixed(0)}%
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ── Tarjeta indicador ─────────────────────────────────────────────────────── */
function IndicatorCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF", border: "2.5px solid #0A0A0A",
        boxShadow: "4px 4px 0 #0A0A0A", padding: 18,
        position: "relative", overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: color }} />
      <div
        style={{
          fontSize: 9, fontWeight: 700, color: "#666",
          letterSpacing: 2, marginBottom: 12, marginTop: 2, fontFamily: FF,
        }}
      >
        {label}
      </div>
      <div
        style={{ fontFamily: FFM, fontSize: 42, color: "#0A0A0A", lineHeight: 1 }}
      >
        {value}<span style={{ fontSize: 20 }}>%</span>
      </div>
      <div style={{ marginTop: 12, height: 10, background: "#F5F0E8", border: "2px solid #0A0A0A" }}>
        <div style={{ height: "100%", width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}
