"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store/game-store";
import { getGameState } from "@/app/actions/game";
import { getDemoGameId } from "@/app/actions/demo";
import { getCongressData } from "@/app/actions/congress";
import type { LawProposalData } from "@/app/actions/congress";
import type { LawCatalogEntry } from "@/lib/engine/types";
import { LawCatalog, LawCatalogLoading } from "@/components/game/congress/law-catalog";
import { ActiveLaws } from "@/components/game/congress/active-laws";
import { LawProposalsHistory } from "@/components/game/congress/law-proposals-history";
import { SenateHemicycle } from "@/components/game/congress/senate-hemicycle";
import { PartyList } from "@/components/game/congress/party-list";
import { NegotiationPanel } from "@/components/game/congress/negotiation-panel";
import { MotionsPanel } from "@/components/game/congress/motions-panel";

const FF  = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";
const FFM = "var(--font-share-tech-mono,'Share Tech Mono',monospace)";

type TabKey = "catalogo" | "activas" | "historial" | "senado" | "mociones";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "catalogo",  label: "CATÁLOGO",    icon: "◎" },
  { key: "activas",   label: "LEYES ACTIVAS",icon: "◈" },
  { key: "historial", label: "HISTORIAL",   icon: "▦" },
  { key: "senado",    label: "SENADO",      icon: "⬢" },
  { key: "mociones",  label: "MOCIONES",    icon: "⚖" },
];

export default function CongresoPage() {
  const gameState   = useGameStore((s) => s.gameState);
  const setGameState= useGameStore((s) => s.setGameState);
  const setGameId   = useGameStore((s) => s.setGameId);
  const pendingInput= useGameStore((s) => s.pendingInput);
  const proposedLaws= pendingInput.proposedLaws ?? [];
  const proposeLaw  = useGameStore((s) => s.proposeLaw);

  const [lawCatalog,   setLawCatalog]   = useState<LawCatalogEntry[] | null>(null);
  const [lawProposals, setLawProposals] = useState<LawProposalData[] | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [activeTab,    setActiveTab]    = useState<TabKey>("catalogo");

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const id = await getDemoGameId();
      if (!id) { setIsLoading(false); return; }
      setGameId(id);
      const [state, congress] = await Promise.all([getGameState(id), getCongressData(id)]);
      if (state)   setGameState(state);
      if (congress) { setLawCatalog(congress.lawCatalog); setLawProposals(congress.lawProposals); }
      setIsLoading(false);
    }
    load();
  }, [setGameId, setGameState]);

  const generalApproval = (() => {
    if (!gameState?.socialClasses || gameState.socialClasses.length === 0) return 50;
    let weighted = 0; let total = 0;
    for (const sc of gameState.socialClasses) { weighted += sc.approval * sc.populationPercent; total += sc.populationPercent; }
    return total > 0 ? Math.round((weighted / total) * 10) / 10 : 50;
  })();

  const totalSeats = (gameState?.parties ?? []).reduce((s, p) => s + (p.seatsLower ?? 0), 0);

  return (
    <div style={{ maxWidth: 1100, fontFamily: FF }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ background: "#0A0A0A", color: "#FFFFFF", fontSize: 9, fontWeight: 700, letterSpacing: 2.5, padding: "4px 12px", display: "inline-block", marginBottom: 10 }}>
          MÓDULO LEGISLATIVO
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, color: "#0A0A0A", letterSpacing: 4, marginBottom: 4 }}>
          CONGRESO FEDERAL
        </div>
        <div style={{ fontSize: 13, color: "#555", fontWeight: 600 }}>
          {totalSeats} ESCAÑOS · MAYORÍA SIMPLE: {Math.floor(totalSeats / 2) + 1} · MAYORÍA CALIFICADA: {Math.floor(totalSeats * 2 / 3) + 1}
        </div>
      </div>

      {isLoading ? (
        <div>
          <div style={{ height: 48, background: "#E8E0D8", border: "2.5px solid #0A0A0A", marginBottom: 18 }} />
          <LawCatalogLoading />
        </div>
      ) : (
        <>
          {/* GOV.OS Tab nav */}
          <div style={{ display: "flex", gap: 0, marginBottom: 18, borderBottom: "2px solid #0A0A0A" }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "10px 16px",
                  background: activeTab === t.key ? "#0A0A0A" : "transparent",
                  border: "none",
                  borderBottom: activeTab === t.key ? "2px solid #00C2B8" : "2px solid transparent",
                  fontFamily: FF,
                  fontSize: 11, fontWeight: 800,
                  color: activeTab === t.key ? "#FFFFFF" : "#666",
                  letterSpacing: 1.5,
                  marginBottom: -2,
                }}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "catalogo" && (
            lawCatalog ? (
              <LawCatalog
                laws={lawCatalog}
                proposedLaws={proposedLaws}
                activeLaws={gameState?.activeLaws.map((l) => l.lawKey) ?? []}
                onPropose={proposeLaw}
                senators={gameState?.senators ?? []}
                parties={gameState?.parties ?? []}
                approval={generalApproval}
                population={gameState?.population}
                treasury={gameState?.treasury}
              />
            ) : <LawCatalogLoading />
          )}
          {activeTab === "activas" && (
            <ActiveLaws activeLaws={gameState?.activeLaws ?? []} population={gameState?.population} />
          )}
          {activeTab === "historial" && (
            <LawProposalsHistory proposals={lawProposals ?? []} />
          )}
          {activeTab === "senado" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <SenateHemicycle senators={gameState?.senators ?? []} parties={gameState?.parties ?? []} />
              <PartyList parties={gameState?.parties ?? []} officials={gameState?.officials ?? []} />
              <NegotiationPanel parties={gameState?.parties ?? []} officials={gameState?.officials ?? []} ministries={gameState?.ministries ?? []} />
            </div>
          )}
          {activeTab === "mociones" && <MotionsPanel />}
        </>
      )}
    </div>
  );
}
