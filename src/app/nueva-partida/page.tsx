"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createGame } from "@/app/actions/game";
import type { PresetKey, Difficulty } from "@/lib/game-factory";

const FF  = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";
const FFM = "var(--font-share-tech-mono,'Share Tech Mono',monospace)";

const PRESETS: { key: PresetKey; title: string; description: string; tag: string; color: string }[] = [
  {
    key: "estable_democratico",
    title: "ESTABLE DEMOCRÁTICO",
    tag: "RECOMENDADO",
    color: "#00C87E",
    description:
      "Democracia consolidada con instituciones sólidas, baja corrupción y economía estable. El desafío es mantener el equilibrio sin caer en la complacencia.",
  },
  {
    key: "pobre_con_potencial",
    title: "POBRE CON POTENCIAL",
    tag: "DESAFÍO MEDIO",
    color: "#E08800",
    description:
      "País en desarrollo con grandes recursos naturales pero alta desigualdad. El desafío es sacar a la población de la pobreza sin romper el tejido social.",
  },
  {
    key: "crisis_economica",
    title: "CRISIS ECONÓMICA",
    tag: "DIFÍCIL",
    color: "#FF6600",
    description:
      "Recesión profunda, inflación galopante y desempleo masivo. El desafío es estabilizar la economía antes de que el malestar social desborde.",
  },
  {
    key: "post_conflicto",
    title: "POST-CONFLICTO",
    tag: "MUY DIFÍCIL",
    color: "#FF2090",
    description:
      "País que emerge de un conflicto armado interno. Instituciones frágiles, corrupción rampante y heridas abiertas. El desafío es reconstruir sin recaer en la violencia.",
  },
];

const DIFFICULTIES: { key: Difficulty; title: string; description: string; color: string }[] = [
  { key: "facil",   title: "FÁCIL",   color: "#00C87E", description: "Menos eventos negativos, corrupción inicial baja, más margen de error." },
  { key: "normal",  title: "NORMAL",  color: "#00C2B8", description: "Balance estándar de desafíos y oportunidades." },
  { key: "dificil", title: "DIFÍCIL", color: "#FF2090", description: "Eventos negativos frecuentes, corrupción alta, poca tolerancia al error." },
];

export default function NuevaPartidaPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [countryName, setCountryName] = useState("");
  const [preset, setPreset] = useState<PresetKey | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canProceed1 = countryName.trim().length >= 3;
  const canProceed2 = preset !== null;
  const canCreate = canProceed1 && canProceed2;

  async function handleCreate() {
    if (!canCreate || !preset) return;
    setIsCreating(true);
    setError(null);
    try {
      const gameId = await createGame({ countryName: countryName.trim(), preset, difficulty });
      router.push(`/dashboard?id=${gameId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear la partida");
      setIsCreating(false);
    }
  }

  const selectedPreset = PRESETS.find((p) => p.key === preset);
  const selectedDiff   = DIFFICULTIES.find((d) => d.key === difficulty);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F5F0E8",
        fontFamily: FF,
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 620 }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              background: "#0A0A0A", color: "#FFFFFF", fontSize: 9, fontWeight: 700,
              letterSpacing: 2.5, padding: "4px 12px", display: "inline-block", marginBottom: 10,
            }}
          >
            GOV.OS · CONFIGURACIÓN
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#0A0A0A", letterSpacing: 4, marginBottom: 6 }}>
            NUEVA PARTIDA
          </div>
          {/* Step indicators */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {[1, 2, 3].map((s) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 28, height: 28, border: `2px solid ${s <= step ? "#0A0A0A" : "rgba(0,0,0,0.2)"}`,
                    background: s === step ? "#0A0A0A" : s < step ? "#00C2B8" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: FFM, fontSize: 12, fontWeight: 700,
                    color: s === step ? "#FFFFFF" : s < step ? "#0A0A0A" : "rgba(0,0,0,0.3)",
                  }}
                >
                  {s < step ? "✓" : s}
                </div>
                {s < 3 && (
                  <div style={{ width: 32, height: 2, background: s < step ? "#00C2B8" : "rgba(0,0,0,0.15)" }} />
                )}
              </div>
            ))}
            <span style={{ fontSize: 10, fontWeight: 700, color: "#666", letterSpacing: 1, marginLeft: 4 }}>
              {step === 1 ? "NOMBRE DEL PAÍS" : step === 2 ? "ESCENARIO INICIAL" : "DIFICULTAD"}
            </span>
          </div>
        </div>

        {/* Panel */}
        <div
          style={{
            background: "#FFFFFF",
            border: "2.5px solid #0A0A0A",
            boxShadow: "6px 6px 0 #0A0A0A",
            padding: 28,
          }}
        >
          {/* PASO 1: Nombre */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#0A0A0A", letterSpacing: 2, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #0A0A0A" }}>
                NOMBRE DEL PAÍS
              </div>
              <label style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "#666", marginBottom: 8 }}>
                NOMBRE OFICIAL
              </label>
              <input
                type="text"
                placeholder="Ej: República de Aurora"
                value={countryName}
                onChange={(e) => setCountryName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canProceed1 && setStep(2)}
                maxLength={40}
                autoFocus
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "#F5F0E8",
                  border: "2px solid #0A0A0A",
                  fontFamily: FF,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#0A0A0A",
                  outline: "none",
                  boxSizing: "border-box",
                  letterSpacing: 1,
                }}
              />
              {countryName.length > 0 && countryName.length < 3 && (
                <p style={{ fontSize: 11, color: "#FF2090", fontWeight: 700, marginTop: 6 }}>
                  Mínimo 3 caracteres
                </p>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                <button
                  onClick={() => setStep(2)}
                  disabled={!canProceed1}
                  style={{
                    cursor: canProceed1 ? "pointer" : "not-allowed",
                    padding: "12px 28px",
                    background: canProceed1 ? "#0A0A0A" : "#ccc",
                    border: "2.5px solid #0A0A0A",
                    boxShadow: canProceed1 ? "3px 3px 0 #00C2B8" : "none",
                    fontFamily: FF, fontSize: 13, fontWeight: 900,
                    color: "#FFFFFF", letterSpacing: 2,
                  }}
                >
                  SIGUIENTE ▶
                </button>
              </div>
            </div>
          )}

          {/* PASO 2: Escenario */}
          {step === 2 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#0A0A0A", letterSpacing: 2, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #0A0A0A" }}>
                ESCENARIO INICIAL
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {PRESETS.map((p) => {
                  const isSelected = preset === p.key;
                  return (
                    <button
                      key={p.key}
                      onClick={() => setPreset(p.key)}
                      style={{
                        textAlign: "left",
                        padding: 14,
                        background: isSelected ? "#F5F0E8" : "#FAFAFA",
                        border: `2px solid ${isSelected ? p.color : "#0A0A0A"}`,
                        boxShadow: isSelected ? `3px 3px 0 ${p.color}` : "none",
                        cursor: "pointer",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      {isSelected && (
                        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 5, background: p.color }} />
                      )}
                      <div style={{ paddingLeft: isSelected ? 12 : 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 900, color: "#0A0A0A", letterSpacing: 1 }}>{p.title}</span>
                          <span style={{ background: p.color, color: "#FFFFFF", fontSize: 8, fontWeight: 800, letterSpacing: 1.5, padding: "2px 7px" }}>{p.tag}</span>
                        </div>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "#555", lineHeight: 1.5 }}>{p.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    cursor: "pointer", padding: "12px 20px",
                    background: "transparent", border: "2px solid #0A0A0A",
                    fontFamily: FF, fontSize: 13, fontWeight: 700,
                    color: "#0A0A0A", letterSpacing: 1,
                  }}
                >
                  ◀ ATRÁS
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!canProceed2}
                  style={{
                    cursor: canProceed2 ? "pointer" : "not-allowed",
                    padding: "12px 28px",
                    background: canProceed2 ? "#0A0A0A" : "#ccc",
                    border: "2.5px solid #0A0A0A",
                    boxShadow: canProceed2 ? "3px 3px 0 #00C2B8" : "none",
                    fontFamily: FF, fontSize: 13, fontWeight: 900,
                    color: "#FFFFFF", letterSpacing: 2,
                  }}
                >
                  SIGUIENTE ▶
                </button>
              </div>
            </div>
          )}

          {/* PASO 3: Dificultad + Confirmar */}
          {step === 3 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#0A0A0A", letterSpacing: 2, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #0A0A0A" }}>
                DIFICULTAD
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {DIFFICULTIES.map((d) => {
                  const isSelected = difficulty === d.key;
                  return (
                    <button
                      key={d.key}
                      onClick={() => setDifficulty(d.key)}
                      style={{
                        textAlign: "left", padding: 14,
                        background: isSelected ? "#F5F0E8" : "#FAFAFA",
                        border: `2px solid ${isSelected ? d.color : "#0A0A0A"}`,
                        boxShadow: isSelected ? `3px 3px 0 ${d.color}` : "none",
                        cursor: "pointer",
                        position: "relative", overflow: "hidden",
                      }}
                    >
                      {isSelected && (
                        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 5, background: d.color }} />
                      )}
                      <div style={{ paddingLeft: isSelected ? 12 : 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 900, color: "#0A0A0A", letterSpacing: 1, marginBottom: 3 }}>{d.title}</div>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "#555" }}>{d.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Resumen */}
              <div
                style={{
                  padding: "14px 16px",
                  border: "2px solid #0A0A0A",
                  background: "#F5F0E8",
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "#666", marginBottom: 10 }}>RESUMEN</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700 }}>
                    <span style={{ color: "#666" }}>PAÍS</span>
                    <span style={{ color: "#0A0A0A" }}>{countryName}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700 }}>
                    <span style={{ color: "#666" }}>ESCENARIO</span>
                    <span style={{ color: "#0A0A0A" }}>{selectedPreset?.title}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700 }}>
                    <span style={{ color: "#666" }}>DIFICULTAD</span>
                    <span style={{ color: selectedDiff?.color ?? "#0A0A0A" }}>{selectedDiff?.title}</span>
                  </div>
                </div>
              </div>

              {error && (
                <div
                  style={{
                    padding: "10px 14px",
                    border: "2px solid #FF2090",
                    borderLeft: "6px solid #FF2090",
                    background: "rgba(255,32,144,0.06)",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#FF2090",
                    marginBottom: 16,
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    cursor: "pointer", padding: "12px 20px",
                    background: "transparent", border: "2px solid #0A0A0A",
                    fontFamily: FF, fontSize: 13, fontWeight: 700,
                    color: "#0A0A0A", letterSpacing: 1,
                  }}
                >
                  ◀ ATRÁS
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!canCreate || isCreating}
                  style={{
                    cursor: (!canCreate || isCreating) ? "not-allowed" : "pointer",
                    padding: "12px 28px",
                    background: isCreating ? "#008E8A" : "#00C2B8",
                    border: "2.5px solid #0A0A0A",
                    boxShadow: "3px 3px 0 #0A0A0A",
                    fontFamily: FF, fontSize: 13, fontWeight: 900,
                    color: "#0A0A0A", letterSpacing: 2,
                    opacity: (!canCreate || isCreating) ? 0.7 : 1,
                  }}
                >
                  {isCreating ? "▶ CREANDO PARTIDA..." : "▶ INICIAR GOBIERNO"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
