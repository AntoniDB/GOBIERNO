"use client";

import { useGameStore } from "@/lib/store/game-store";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { NotificationsPanel } from "@/components/game/notifications-panel";
import { AiAdvisorPanel } from "@/components/game/ai-advisor-panel";
import { checkAiAvailability } from "@/app/actions/ai";

const NAV_ITEMS = [
  { label: "DASHBOARD", icon: "▣", href: "/dashboard" },
  { label: "MINISTERIOS", icon: "⬡", href: "/ministerios" },
  { label: "CONGRESO", icon: "⬢", href: "/congreso" },
  { label: "JUSTICIA", icon: "⚖", href: "/justicia" },
  { label: "POBLACIÓN", icon: "◈", href: "/poblacion" },
  { label: "MEDIOS", icon: "◉", href: "/medios" },
  { label: "RÉGIMEN", icon: "◆", href: "/regimen" },
  { label: "REPORTES", icon: "▦", href: "/reportes" },
];

function valueColor(v: number, inverse = false): string {
  if (inverse) {
    if (v < 25) return "#00C87E";
    if (v < 50) return "#E08800";
    return "#FF2090";
  }
  if (v > 60) return "#00C87E";
  if (v > 35) return "#E08800";
  return "#FF2090";
}

export function GameShell({ children }: { children: React.ReactNode }) {
  const gameState = useGameStore((s) => s.gameState);
  const lastTurnResult = useGameStore((s) => s.lastTurnResult);
  const advanceMonth = useGameStore((s) => s.advanceMonth);
  const isLoading = useGameStore((s) => s.isLoading);
  const gameOver = useGameStore((s) => s.gameOver);
  const gameId = useGameStore((s) => s.gameId);
  const pathname = usePathname();
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [time, setTime] = useState("00:00");

  useEffect(() => {
    checkAiAvailability().then(setAiAvailable);
  }, []);

  useEffect(() => {
    const update = () => {
      const d = new Date();
      setTime(`${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`);
    };
    update();
    const t = setInterval(update, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (gameOver) router.push("/fin");
  }, [gameOver, router]);

  const snapshot = lastTurnResult?.monthSnapshot;
  const approval = Math.round(snapshot?.approval ?? 50);
  const corruption = Math.round(snapshot?.corruption ?? 30);

  const stability = (() => {
    if (!gameState?.regimeMetrics) return 50;
    const m = gameState.regimeMetrics;
    return Math.round(
      (m.politicalPluralism + m.civilLiberties + m.transparency +
        m.judicialIndependence + m.pressFreedom) / 5
    );
  })();

  const unresolvedCount = (gameState?.events ?? []).filter((e) => !e.resolvedAt).length;

  const president =
    gameState?.officials?.find((o) => o.role === "POLITICAL_LEADER")?.name ?? "Presidente";

  const gdpRaw = gameState?.gdp ?? 0;
  const gdpLabel =
    gdpRaw >= 1e12
      ? `${(gdpRaw / 1e12).toFixed(2)}T`
      : `${(gdpRaw / 1e9).toFixed(1)}B`;

  const countryInitial = (gameState?.countryName ?? "G")[0].toUpperCase();
  const countryName = (gameState?.countryName ?? "GOV.OS").toUpperCase();
  const turnLabel = gameState
    ? `${gameState.currentYear}/${String(gameState.currentMonth).padStart(2, "0")}`
    : "—";

  async function handleAdvance() {
    try {
      await advanceMonth();
      setShowNotifications(true);
    } catch {
      /* store handles errors */
    }
  }

  const aColor = valueColor(approval);
  const sColor = valueColor(stability);

  /* ── font vars with fallbacks ── */
  const ff = "var(--font-barlow-condensed, 'Barlow Condensed', sans-serif)";
  const ffMono = "var(--font-share-tech-mono, 'Share Tech Mono', monospace)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#F5F0E8",
        color: "#0A0A0A",
        fontFamily: ff,
        overflow: "hidden",
      }}
    >
      {/* ═══ TOP BAR ═══ */}
      <div
        style={{
          flexShrink: 0,
          height: 64,
          background: "#0A0A0A",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            paddingRight: 20,
            borderRight: "2px solid rgba(255,255,255,0.12)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              border: "3px solid #00C2B8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: "rotate(45deg)",
            }}
          >
            <span
              style={{
                transform: "rotate(-45deg)",
                fontFamily: ff,
                fontWeight: 900,
                fontSize: 16,
                color: "#00C2B8",
              }}
            >
              {countryInitial}
            </span>
          </div>
          <div>
            <div
              style={{
                fontFamily: ff,
                fontWeight: 900,
                fontSize: 22,
                color: "#FFFFFF",
                letterSpacing: 5,
                lineHeight: 1,
              }}
            >
              {countryName}
            </div>
            <div
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,0.35)",
                letterSpacing: 2,
                fontWeight: 600,
              }}
            >
              GOV.OS · {turnLabel}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 24,
            padding: "0 24px",
          }}
        >
          <TopStat label="APROBACIÓN" value={`${approval}%`} color={aColor} ffMono={ffMono} />
          <VSep />
          <TopStat label="ESTABILIDAD" value={`${stability}%`} color={sColor} ffMono={ffMono} />
          <VSep />
          <TopStat label="PIB" value={gdpLabel} color="#00C2B8" ffMono={ffMono} />
          <VSep />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,0.4)",
                letterSpacing: 2,
                fontWeight: 700,
              }}
            >
              ALERTAS
            </span>
            <div
              style={{
                background: "#FF2090",
                color: "#FFFFFF",
                fontFamily: ffMono,
                fontSize: 15,
                fontWeight: 700,
                padding: "2px 10px",
                border: "2px solid #FFFFFF",
              }}
            >
              {unresolvedCount}
            </div>
          </div>
        </div>

        {/* AVANZAR */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 12,
            paddingRight: 20,
            borderRight: "2px solid rgba(255,255,255,0.12)",
          }}
        >
          <button
            onClick={handleAdvance}
            disabled={!gameState || isLoading || !!gameOver}
            style={{
              cursor:
                !gameState || isLoading || !!gameOver ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "0 24px",
              height: 42,
              background: isLoading ? "#008E8A" : "#00C2B8",
              border: "2.5px solid #FFFFFF",
              boxShadow: "3px 3px 0 #FFFFFF",
              fontFamily: ff,
              fontSize: 15,
              fontWeight: 900,
              color: "#0A0A0A",
              letterSpacing: 3,
              opacity: !gameState || !!gameOver ? 0.5 : 1,
            }}
          >
            {isLoading ? "▶ PROCESANDO..." : "▶ AVANZAR"}
          </button>
          <div
            style={{
              fontSize: 9,
              color: "rgba(255,255,255,0.3)",
              letterSpacing: 2,
              textAlign: "center",
              marginTop: 3,
              fontWeight: 600,
            }}
          >
            TURNO {turnLabel}
          </div>
          {aiAvailable && (
            <button
              onClick={() => setShowAdvisor(true)}
              disabled={!gameState || !!gameOver}
              title="Consultar Asesor IA"
              style={{
                cursor: !gameState || !!gameOver ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 42,
                height: 42,
                background: "#1A1A2E",
                border: "2.5px solid #00C2B8",
                boxShadow: "3px 3px 0 #00C2B8",
                opacity: !gameState || !!gameOver ? 0.5 : 1,
              }}
            >
              <Sparkles style={{ width: 20, height: 20, color: "#00C2B8" }} />
            </button>
          )}
        </div>

        {/* Presidente + Reloj */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 16,
            paddingLeft: 20,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,0.35)",
                letterSpacing: 1.5,
                fontWeight: 700,
              }}
            >
              PRESIDENTE
            </div>
            <div
              style={{ fontSize: 14, color: "#FFFFFF", fontWeight: 700, letterSpacing: 0.5 }}
            >
              {president}
            </div>
          </div>
          <VSep />
          <div style={{ fontFamily: ffMono, fontSize: 20, color: "#00C2B8", letterSpacing: 2 }}>
            {time}
          </div>
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* SIDEBAR */}
        <div
          style={{
            flexShrink: 0,
            width: 216,
            background: "#FFFFFF",
            borderRight: "3px solid #0A0A0A",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ flex: 1, overflowY: "auto" }}>
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    borderLeft: `4px solid ${isActive ? "#00C2B8" : "transparent"}`,
                    borderBottom: "1px solid rgba(0,0,0,0.07)",
                    background: isActive ? "#F5F0E8" : "#FFFFFF",
                    color: isActive ? "#0A0A0A" : "#666",
                    fontSize: 12,
                    fontWeight: isActive ? 800 : 600,
                    letterSpacing: 2,
                    textTransform: "uppercase" as const,
                    minHeight: 44,
                    textDecoration: "none",
                    fontFamily: ff,
                  }}
                >
                  <span
                    style={{ fontSize: 15, width: 18, textAlign: "center", flexShrink: 0 }}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
          <div
            style={{
              padding: "12px 16px",
              borderTop: "3px solid #0A0A0A",
              fontSize: 9,
              color: "#888",
              lineHeight: 2.2,
              fontWeight: 700,
              letterSpacing: 1,
              background: "#FFFFFF",
              fontFamily: ff,
            }}
          >
            <div>● SYS: ONLINE</div>
            <div>● CIFRADO: AES-2048</div>
            <div>● SESIÓN: SEGURA</div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 9,
                color: "#888",
                fontWeight: 700,
                letterSpacing: 1,
                padding: 0,
                fontFamily: ff,
                marginTop: 2,
              }}
            >
              ● CERRAR SESIÓN
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: 28,
          }}
        >
          {children}
        </main>
      </div>

      <NotificationsPanel open={showNotifications} onOpenChange={setShowNotifications} />
      {aiAvailable && (
        <AiAdvisorPanel
          open={showAdvisor}
          onOpenChange={setShowAdvisor}
          gameId={gameId ?? ""}
          currentYear={gameState?.currentYear ?? 1}
          currentMonth={gameState?.currentMonth ?? 1}
        />
      )}
    </div>
  );
}

function TopStat({
  label,
  value,
  color,
  ffMono,
}: {
  label: string;
  value: string;
  color: string;
  ffMono: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          fontSize: 9,
          color: "rgba(255,255,255,0.4)",
          letterSpacing: 2,
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      <span style={{ fontFamily: ffMono, fontSize: 18, color }}>{value}</span>
    </div>
  );
}

function VSep() {
  return (
    <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.12)" }} />
  );
}
