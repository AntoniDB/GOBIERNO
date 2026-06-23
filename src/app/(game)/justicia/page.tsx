"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store/game-store";
import { getGameState } from "@/app/actions/game";
import { getDemoGameId } from "@/app/actions/demo";
import { CaseList } from "@/components/game/justicia/case-list";
import { OfficialList } from "@/components/game/justicia/official-list";
import { OrganismList } from "@/components/game/justicia/organism-list";
import { CandidatesPanel } from "@/components/game/justicia/candidates-panel";

const FF = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";

type TabKey = "casos" | "funcionarios" | "organismos" | "candidatos";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "casos",        label: "CASOS ACTIVOS",  icon: "⚖"  },
  { key: "funcionarios", label: "FUNCIONARIOS",   icon: "◈"  },
  { key: "organismos",   label: "ORGANISMOS",     icon: "⬡"  },
  { key: "candidatos",   label: "CANDIDATOS",     icon: "◉"  },
];

export default function JusticiaPage() {
  const gameState    = useGameStore((s) => s.gameState);
  const setGameState = useGameStore((s) => s.setGameState);
  const setGameId    = useGameStore((s) => s.setGameId);
  const [activeTab, setActiveTab] = useState<TabKey>("casos");

  useEffect(() => {
    getDemoGameId().then((id) => {
      if (!id) return;
      setGameId(id);
      getGameState(id).then((state) => { if (state) setGameState(state); });
    });
  }, [setGameId, setGameState]);

  if (!gameState) {
    return (
      <div style={{ maxWidth: 1100, fontFamily: FF }}>
        <div style={{ height: 28, background: "#E8E0D8", marginBottom: 18, width: 200 }} />
        <div style={{ height: 48, background: "#E8E0D8", border: "2.5px solid #0A0A0A", marginBottom: 18 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {[0,1,2,3,4,5].map((i) => (
            <div key={i} style={{ height: 140, background: "#E8E0D8", border: "2.5px solid #0A0A0A" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, fontFamily: FF }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ background: "#CC2244", color: "#FFFFFF", fontSize: 9, fontWeight: 700, letterSpacing: 2.5, padding: "4px 12px", display: "inline-block", marginBottom: 10 }}>
          MÓDULO JUDICIAL
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, color: "#0A0A0A", letterSpacing: 4, marginBottom: 4 }}>
          SISTEMA DE JUSTICIA
        </div>
        <div style={{ fontSize: 13, color: "#555", fontWeight: 600 }}>
          {(gameState.judicialCases ?? []).length} CASOS ACTIVOS · {(gameState.organisms ?? []).length} ORGANISMOS
        </div>
      </div>

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
              borderBottom: activeTab === t.key ? "2px solid #CC2244" : "2px solid transparent",
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
      {activeTab === "casos" && (
        <CaseList cases={gameState.judicialCases} officials={gameState.officials} />
      )}
      {activeTab === "funcionarios" && (
        <OfficialList
          officials={gameState.officials}
          onInvestigate={(officialId) => {
            const pendingInput = useGameStore.getState().pendingInput;
            useGameStore.setState({
              pendingInput: {
                ...pendingInput,
                investigations: [...(pendingInput.investigations ?? []), officialId],
              },
            });
          }}
        />
      )}
      {activeTab === "organismos" && (
        <OrganismList organisms={gameState.organisms} officials={gameState.officials} />
      )}
      {activeTab === "candidatos" && <CandidatesPanel />}
    </div>
  );
}
