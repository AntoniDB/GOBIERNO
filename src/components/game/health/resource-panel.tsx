"use client";

import { useGameStore } from "@/lib/store/game-store";
import {
  calculateMedicalProduction,
  calculateMedicalDemand,
  calculateHospitalOperationalFactor,
} from "@/lib/engine/medical-professionals";

const FF = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";
const FFM = "var(--font-share-tech-mono,'Share Tech Mono',monospace)";

export function ResourcePanel() {
  const gameState = useGameStore((s) => s.gameState);

  if (!gameState) return null;

  const production = calculateMedicalProduction(gameState);
  const demand = calculateMedicalDemand(gameState);
  const balance = production - demand;
  const stock =
    gameState.resourceStocks.find((s) => s.resourceType === "medical_professionals")?.quantity ?? 0;
  const operationalFactor = calculateHospitalOperationalFactor(gameState);

  // Indicador visual
  let status: { color: string; label: string };
  if (operationalFactor >= 1.0) {
    status = { color: "#00C87E", label: "SUPERÁVIT" };
  } else if (operationalFactor >= 0.7) {
    status = { color: "#E08800", label: "DÉFICIT LEVE" };
  } else if (operationalFactor > 0.2) {
    status = { color: "#FF6600", label: "DÉFICIT SEVERO" };
  } else {
    status = { color: "#FF2090", label: "COLAPSO" };
  }

  const operationalPct = Math.round(operationalFactor * 100);

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "2.5px solid #0A0A0A",
        boxShadow: "4px 4px 0 #2468CC",
        padding: 18,
        marginBottom: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: "2px solid #0A0A0A",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              background: "#2468CC",
              color: "#FFFFFF",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2,
              padding: "3px 10px",
              fontFamily: FF,
            }}
          >
            SAL · RECURSOS
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#0A0A0A",
              letterSpacing: 2,
              fontFamily: FF,
            }}
          >
            PROFESIONALES MÉDICOS
          </span>
        </div>
        <span
          style={{
            background: status.color,
            color: "#FFFFFF",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: 1.5,
            padding: "3px 10px",
            fontFamily: FF,
          }}
        >
          {status.label}
        </span>
      </div>

      <p
        style={{
          fontSize: 10,
          color: "#777",
          fontWeight: 600,
          margin: 0,
          marginBottom: 12,
          lineHeight: 1.5,
        }}
      >
        Educación produce médicos a partir de su presupuesto + eficiencia. Salud
        los consume proporcionalmente a la capacidad hospitalaria total. Con
        déficit, los hospitales operan por debajo de su capacidad (sin afectar la
        eficiencia de gestión del ministerio).
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <ResourceCell label="STOCK ACTUAL" value={Math.round(stock).toLocaleString("es")} color="#0A0A0A" />
        <ResourceCell
          label="FACTOR OPERATIVO"
          value={`${operationalPct}%`}
          color={status.color}
        />
        <ResourceCell
          label="PRODUCCIÓN / MES"
          value={Math.round(production).toLocaleString("es")}
          color="#00C87E"
        />
        <ResourceCell
          label="DEMANDA / MES"
          value={Math.round(demand).toLocaleString("es")}
          color="#FF6600"
        />
      </div>

      <div
        style={{
          padding: "10px 12px",
          border: "2px solid #0A0A0A",
          background: balance >= 0 ? "#F0FAF5" : "#FFF5F0",
          borderLeft: `5px solid ${balance >= 0 ? "#00C87E" : "#FF2090"}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 800, color: "#0A0A0A", letterSpacing: 1, fontFamily: FF }}>
            BALANCE MENSUAL
          </span>
          <span
            style={{
              fontFamily: FFM,
              fontSize: 16,
              fontWeight: 800,
              color: balance >= 0 ? "#00C87E" : "#FF2090",
            }}
          >
            {balance >= 0 ? "+" : ""}
            {Math.round(balance).toLocaleString("es")}
          </span>
        </div>
      </div>
    </div>
  );
}

function ResourceCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        padding: "8px 10px",
        border: "1.5px solid #0A0A0A",
        background: "#FAFAFA",
      }}
    >
      <div
        style={{
          fontSize: 8,
          fontWeight: 700,
          color: "#888",
          letterSpacing: 1.5,
          fontFamily: FF,
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: FFM }}>{value}</div>
    </div>
  );
}