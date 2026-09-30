"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/store/game-store";
import { BALANCE } from "@/lib/balance";
import { scaleCost } from "@/lib/engine/cost-scale";
import {
  buildHospitalConstructionInput,
  buildMedicalResearchInput,
} from "@/lib/engine/long-running-decisions";

const FF = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";
const FFM = "var(--font-share-tech-mono,'Share Tech Mono',monospace)";

type Tab = "persistentes" | "largo_plazo";

interface DiseaseLite {
  id: string;
  name: string;
  hasVaccine: boolean;
  category: string;
}

function fmtCost(n: number): string {
  if (n >= 1e6) return `M$ ${(n / 1e6).toFixed(1)}M`;
  return `M$ ${n}`;
}

export function ProgramLaunchModal({ onClose }: { onClose: () => void }) {
  const gameState = useGameStore((s) => s.gameState);
  const startProgram = useGameStore((s) => s.startProgram);
  const startLRD = useGameStore((s) => s.startLongRunningDecision);
  const [tab, setTab] = useState<Tab>("persistentes");
  const [vaccineDiseaseId, setVaccineDiseaseId] = useState<string | null>(null);
  const [hospitalRegionId, setHospitalRegionId] = useState<string | null>(null);
  const [hospitalLevel, setHospitalLevel] = useState<"primary" | "secondary" | "tertiary">("primary");
  const [researchDiseaseIds, setResearchDiseaseIds] = useState<string[]>([]);

  if (!gameState) return null;

  const population = gameState.population;
  const diseases = (gameState.diseases ?? []) as unknown as DiseaseLite[];
  const vaccineOptions = diseases.filter((d) => d.hasVaccine);
  const regions = gameState.regions ?? [];
  const researchOptions = diseases;

  function launchVaccination() {
    if (!vaccineDiseaseId) return;
    const disease = diseases.find((d) => d.id === vaccineDiseaseId);
    startProgram("VACCINATION_CAMPAIGN", {
      diseaseId: vaccineDiseaseId,
      diseaseName: disease?.name ?? vaccineDiseaseId,
    });
    onClose();
  }

  function launchPrevention() {
    startProgram("PREVENTION_EDUCATION");
    onClose();
  }

  function launchMentalHealth() {
    startProgram("MENTAL_HEALTH_PROGRAM");
    onClose();
  }

  function launchHospital() {
    if (!hospitalRegionId) return;
    const region = regions.find((r) => r.id === hospitalRegionId);
    const lrd = buildHospitalConstructionInput(hospitalRegionId, hospitalLevel, region?.name ?? "", population);
    startLRD(lrd.type, lrd.name, lrd.totalMonths, lrd.monthlyCost, lrd.parameters);
    onClose();
  }

  function toggleResearch(id: string) {
    setResearchDiseaseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 2 ? prev : [...prev, id],
    );
  }

  function launchResearch() {
    if (researchDiseaseIds.length === 0) return;
    const names = researchDiseaseIds.map((id) => diseases.find((d) => d.id === id)?.name ?? id);
    const lrd = buildMedicalResearchInput(researchDiseaseIds, names, population);
    startLRD(lrd.type, lrd.name, lrd.totalMonths, lrd.monthlyCost, lrd.parameters);
    onClose();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          border: "2.5px solid #0A0A0A",
          boxShadow: "6px 6px 0 #0A0A0A",
          width: 700,
          maxWidth: "92vw",
          maxHeight: "88vh",
          overflow: "auto",
          padding: 24,
          fontFamily: FF,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: "2px solid #0A0A0A",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 2 }}>
            LANZAR PROGRAMA OPERATIVO
          </div>
          <button
            onClick={onClose}
            style={{
              cursor: "pointer",
              background: "none",
              border: "none",
              fontSize: 18,
              fontWeight: 800,
              color: "#888",
            }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          <TabButton active={tab === "persistentes"} onClick={() => setTab("persistentes")}>
            PROGRAMAS PERSISTENTES (ON/OFF)
          </TabButton>
          <TabButton active={tab === "largo_plazo"} onClick={() => setTab("largo_plazo")}>
            PROGRAMAS DE LARGO PLAZO (LRD)
          </TabButton>
        </div>

        {tab === "persistentes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Vacunación */}
            <ProgramOption
              title="Campaña de vacunación"
              color="#00C2B8"
              cost={scaleCost(BALANCE.PROGRAM_VACCINATION_COST, gameState.population)}
              description="Elige una enfermedad con vacuna disponible. Reduce su prevalencia hacia un mínimo del 10% de su base. Si se desactiva, vuelve a subir lentamente."
            >
              <label style={{ fontSize: 10, fontWeight: 700, color: "#555", letterSpacing: 1 }}>
                ENFERMEDAD CON VACUNA
              </label>
              <select
                value={vaccineDiseaseId ?? ""}
                onChange={(e) => setVaccineDiseaseId(e.target.value || null)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "5px 8px",
                  border: "1.5px solid #0A0A0A",
                  background: "#FAFAFA",
                  fontFamily: FF,
                  fontSize: 11,
                  fontWeight: 600,
                  marginTop: 4,
                }}
              >
                <option value="">— Selecciona enfermedad —</option>
                {vaccineOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <LaunchButton
                disabled={!vaccineDiseaseId}
                onClick={launchVaccination}
                color="#00C2B8"
              >
                INICIAR CAMPAÑA
              </LaunchButton>
            </ProgramOption>

            {/* Prevención */}
            <ProgramOption
              title="Programa de prevención (educación sanitaria)"
              color="#8844CC"
              cost={scaleCost(BALANCE.PROGRAM_PREVENTION_COST, gameState.population)}
              description="Reduce nuevos casos de transmisibles y crónicos de forma transversal. Efecto sutil pero acumulativo. No requiere elegir enfermedad."
            >
              <LaunchButton onClick={launchPrevention} color="#8844CC">
                INICIAR PREVENCIÓN
              </LaunchButton>
            </ProgramOption>

            {/* Salud mental */}
            <ProgramOption
              title="Programa de salud mental"
              color="#E08800"
              cost={scaleCost(BALANCE.PROGRAM_MENTAL_HEALTH_COST, gameState.population)}
              description="Reduce prevalencia de depresión, ansiedad y adicciones. Mientras esté activo, mejora la aprobación de POVERTY (+3/mes) y MIDDLE (+2/mes)."
            >
              <LaunchButton onClick={launchMentalHealth} color="#E08800">
                INICIAR SALUD MENTAL
              </LaunchButton>
            </ProgramOption>
          </div>
        )}

        {tab === "largo_plazo" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Construcción hospital */}
            <ProgramOption
              title="Construcción de hospital"
              color="#2468CC"
              cost={scaleCost(BALANCE.HOSPITAL_COSTS[hospitalLevel], gameState.population)}
              description={`LRD de ${BALANCE.HOSPITAL_DURATIONS[hospitalLevel]} meses. Al completarse suma camas y facilities permanentes a la región elegida. Cancelar antes pierde lo invertido.`}
            >
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "#555", letterSpacing: 1 }}>
                    REGIÓN
                  </label>
                  <select
                    value={hospitalRegionId ?? ""}
                    onChange={(e) => setHospitalRegionId(e.target.value || null)}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "5px 8px",
                      border: "1.5px solid #0A0A0A",
                      background: "#FAFAFA",
                      fontFamily: FF,
                      fontSize: 11,
                      fontWeight: 600,
                      marginTop: 4,
                    }}
                  >
                    <option value="">— Selecciona región —</option>
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ width: 130 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "#555", letterSpacing: 1 }}>
                    NIVEL
                  </label>
                  <select
                    value={hospitalLevel}
                    onChange={(e) => setHospitalLevel(e.target.value as typeof hospitalLevel)}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "5px 8px",
                      border: "1.5px solid #0A0A0A",
                      background: "#FAFAFA",
                      fontFamily: FF,
                      fontSize: 11,
                      fontWeight: 600,
                      marginTop: 4,
                    }}
                  >
                    <option value="primary">Primario</option>
                    <option value="secondary">Secundario</option>
                    <option value="tertiary">Terciario</option>
                  </select>
                </div>
              </div>
              <div style={{ fontSize: 10, color: "#888", fontWeight: 600, marginTop: 6, display: "flex", gap: 16 }}>
                <span>Costo: <span style={{ fontFamily: FFM, color: "#FF6600" }}>{fmtCost(scaleCost(BALANCE.HOSPITAL_COSTS[hospitalLevel], gameState.population))}/mes</span></span>
                <span>Duración: <span style={{ fontFamily: FFM }}>{BALANCE.HOSPITAL_DURATIONS[hospitalLevel]} meses</span></span>
              </div>
              <LaunchButton
                disabled={!hospitalRegionId}
                onClick={launchHospital}
                color="#2468CC"
              >
                INICIAR CONSTRUCCIÓN
              </LaunchButton>
            </ProgramOption>

            {/* Investigación */}
            <ProgramOption
              title="Investigación en enfermedades locales"
              color="#FF6600"
              cost={scaleCost(BALANCE.MEDICAL_RESEARCH_COST, gameState.population)}
              duration={BALANCE.MEDICAL_RESEARCH_DURATION}
              description="LRD de muy largo plazo. Al completarse desbloquea vacuna para 1-2 enfermedades elegidas que no la tenían, o reduce la mortalidad a la mitad si ya tenían vacuna. La apuesta a largo plazo."
            >
              <label style={{ fontSize: 10, fontWeight: 700, color: "#555", letterSpacing: 1 }}>
                ENFERMEDADES A INVESTIGAR (MÁX 2)
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4, maxHeight: 140, overflow: "auto", border: "1.5px solid #0A0A0A", padding: 6, background: "#FAFAFA" }}>
                {researchOptions.map((d) => {
                  const selected = researchDiseaseIds.includes(d.id);
                  const disabled = !selected && researchDiseaseIds.length >= 2;
                  return (
                    <label
                      key={d.id}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: disabled ? "#CCC" : "#0A0A0A",
                        cursor: disabled ? "not-allowed" : "pointer",
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={disabled}
                        onChange={() => toggleResearch(d.id)}
                      />
                      {d.name}
                      <span style={{ fontSize: 9, color: d.hasVaccine ? "#00C87E" : "#888" }}>
                        {d.hasVaccine ? "(vacuna → reduce mortalidad 50%)" : "(→ desbloquea vacuna)"}
                      </span>
                    </label>
                  );
                })}
              </div>
              <LaunchButton
                disabled={researchDiseaseIds.length === 0}
                onClick={launchResearch}
                color="#FF6600"
              >
                INICIAR INVESTIGACIÓN
              </LaunchButton>
            </ProgramOption>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        cursor: "pointer",
        background: active ? "#0A0A0A" : "#FAFAFA",
        border: "2px solid #0A0A0A",
        color: active ? "#FFFFFF" : "#0A0A0A",
        fontSize: 10,
        fontWeight: 800,
        padding: "6px 12px",
        fontFamily: FF,
        letterSpacing: 1,
      }}
    >
      {children}
    </button>
  );
}

function ProgramOption({
  title,
  color,
  cost,
  duration,
  description,
  children,
}: {
  title: string;
  color: string;
  cost: number;
  duration?: number;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "2px solid #0A0A0A",
        borderLeft: `5px solid ${color}`,
        padding: 12,
        background: "#FFFFFF",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, color: "#0A0A0A", marginBottom: 2 }}>
        {title}
      </div>
      <div style={{ fontSize: 10, color: "#888", fontWeight: 700, marginBottom: 8 }}>
        COSTO: <span style={{ fontFamily: FFM, color: "#FF6600" }}>{fmtCost(cost)}/mes</span>
        {duration !== undefined && (
          <> · DURACIÓN: <span style={{ fontFamily: FFM }}>{duration} meses</span></>
        )}
      </div>
      <p style={{ fontSize: 11, color: "#666", fontWeight: 600, lineHeight: 1.5, margin: 0, marginBottom: 10 }}>
        {description}
      </p>
      {children}
    </div>
  );
}

function LaunchButton({
  disabled,
  onClick,
  color,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        cursor: disabled ? "not-allowed" : "pointer",
        marginTop: 10,
        background: disabled ? "#E8E0D8" : "#0A0A0A",
        border: `2px solid #0A0A0A`,
        color: disabled ? "#AAA" : "#FFFFFF",
        fontSize: 10,
        fontWeight: 800,
        padding: "6px 16px",
        fontFamily: FF,
        letterSpacing: 1.5,
        width: "100%",
      }}
    >
      {children}
    </button>
  );
}