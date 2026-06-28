"use client";

import { useGameStore } from "@/lib/store/game-store";
import type { TradeGoodCategory } from "@/lib/engine/types";
import { treasuryImportFactor, calculateImportCoverage, isMedicationShortage, calculateDemand } from "@/lib/engine/trade";
import { BALANCE } from "@/lib/balance";

const FF = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";
const FFM = "var(--font-share-tech-mono,'Share Tech Mono',monospace)";

function fmt(n: number) {
  return n >= 1_000_000
    ? (n / 1_000_000).toFixed(1) + "M"
    : n >= 1_000
      ? n.toLocaleString("es-CL")
      : n.toFixed(0);
}

function fmtMoney(n: number) {
  return "$" + fmt(n);
}

/**
 * Panel generico de comercio exterior (Salud-3B-i).
 *
 * @param ministryKey  Clave del ministerio (ej. "HEALTH") para etiqueta.
 * @param goodKeys     Filtro opcional de bienes a mostrar (categorias).
 *
 * Uso:
 *   <TradePanel ministryKey="HEALTH" />
 *   <TradePanel ministryKey="HEALTH" goodKeys={["MEDICAMENTS_GENERIC", "MEDICAMENTS_BRAND"]} />
 */
export function TradePanel({
  ministryKey,
  goodCategories,
}: {
  ministryKey: string;
  goodCategories?: TradeGoodCategory[];
}) {
  const gameState = useGameStore((s) => s.gameState);
  const updateTradeFlowTarget = useGameStore((s) => s.updateTradeFlowTarget);

  if (!gameState) return null;

  const flows = gameState.tradeFlows ?? [];
  const goods = gameState.tradeGoods ?? [];

  // Bienes que corresponden a las categorias solicitadas (o todos si no hay filtro)
  const relevantGoods = goodCategories
    ? goods.filter((g) => goodCategories.includes(g.category))
    : goods;

  // Para cada bien, buscar su flujo activo IMPORT
  const activeFlowsByGoodId: Record<string, typeof flows[0]> = {};
  for (const f of flows) {
    if (f.isActive && f.direction === "IMPORT") {
      activeFlowsByGoodId[f.tradeGoodId] = f;
    }
  }

  const hasActiveImports = Object.keys(activeFlowsByGoodId).length > 0;
  const coverage = calculateImportCoverage(gameState);
  const shortage = isMedicationShortage(gameState);
  const treasuryFactor = treasuryImportFactor(gameState.treasury);

  // Stats sobre flujos activos
  const activeFlows = Object.values(activeFlowsByGoodId);
  const totalMonthlyCost = activeFlows.reduce((s, f) => s + f.monthlyCost, 0);
  const totalVolume = activeFlows.reduce((s, f) => s + f.monthlyVolume, 0);
  const totalTarget = activeFlows.reduce((s, f) => s + f.targetVolume, 0);

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "2.5px solid #0A0A0A",
        boxShadow: `4px 4px 0 ${shortage ? "#FF2090" : "#2468CC"}`,
        padding: 18,
        marginBottom: 18,
      }}
    >
      {/* Header */}
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
              background: shortage ? "#FF2090" : "#2468CC",
              color: "#FFFFFF",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2,
              padding: "3px 10px",
              fontFamily: FF,
            }}
          >
            {ministryKey.slice(0, 3).toUpperCase()} · COMERCIO
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
            IMPORTACIONES DE INSUMOS
          </span>
        </div>
        <span
          style={{
            background: hasActiveImports
              ? shortage ? "#FF2090" : "#00C87E"
              : "#888",
            color: "#FFFFFF",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: 1.5,
            padding: "3px 10px",
            fontFamily: FF,
          }}
        >
          {hasActiveImports
            ? shortage ? "ESCASEZ" : `${(coverage * 100).toFixed(0)}% COBERTURA`
            : "SIN IMPORTACIONES"}
        </span>
      </div>

      {/* Descripcion */}
      <p
        style={{
          fontSize: 10,
          color: "#777",
          fontWeight: 600,
          lineHeight: 1.5,
          marginBottom: 12,
        }}
      >
        Balance de importaciones de insumos médicos. El factor de tesorería (
        {(treasuryFactor * 100).toFixed(0)}%) limita el volumen total. Ajusta
        el mix entre genéricos y marca modificando el volumen objetivo.
      </p>

      {/* Stats resumen */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <StatCell
          label="COSTO TOTAL"
          value={fmtMoney(totalMonthlyCost)}
          color={totalMonthlyCost > gameState.treasury * 0.1 ? "#FF2090" : "#0A0A0A"}
        />
        <StatCell
          label="BALANZA"
          value={fmtMoney(gameState.tradeBalance ?? 0)}
          color={(gameState.tradeBalance ?? 0) < 0 ? "#FF2090" : "#00C87E"}
        />
        <StatCell
          label="VOLUMEN RECIBIDO"
          value={!hasActiveImports
            ? "— u."
            : fmt(totalVolume) + (totalTarget > 0 ? ` / ${fmt(totalTarget)} u.` : " u.")}
          color="#0A0A0A"
        />
        <StatCell
          label="TESORERÍA"
          value={fmtMoney(gameState.treasury)}
          color={treasuryFactor < 0.5 ? "#FF2090" : "#0A0A0A"}
        />
      </div>

      {/* Estado vacio: sin importaciones activas */}
      {!hasActiveImports && (
        <div
          style={{
            padding: "14px 16px",
            background: "#F5F0E8",
            border: "2px dashed #AAA",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: "#666",
              letterSpacing: 1.5,
              fontFamily: FF,
              marginBottom: 8,
            }}
          >
            SIN IMPORTACIONES ACTIVAS
          </div>
          <p
            style={{
              fontSize: 10,
              color: "#888",
              fontWeight: 600,
              lineHeight: 1.5,
              marginBottom: 2,
            }}
          >
            No hay importaciones de insumos médicos configuradas. Usa los
            controles debajo para definir el volumen objetivo de cada tipo
            de medicamento. Al avanzar el mes, el sistema comenzará a importar
            según los valores que configures.
          </p>
        </div>
      )}

      {/* Filas por bien (siempre visibles, con slider incluso sin flujo activo) */}
      {relevantGoods.map((good) => {
        const flow = flows.find((f) => f.tradeGoodId === good.id);

        const demand = calculateDemand(gameState.population, good.demandPerCapita);
        const isActive = flow?.isActive && flow.direction === "IMPORT";

        // Si hay flujo activo, usar sus datos; si no, valores por defecto
        const monthlyVolume = isActive ? flow.monthlyVolume : 0;
        const targetVolume = isActive ? flow.targetVolume : 0;
        const monthlyCost = isActive ? flow.monthlyCost : 0;
        const sanctionsM = flow?.sanctionsMultiplier ?? 1.0;
        const pct = targetVolume > 0
          ? Math.round((monthlyVolume / targetVolume) * 100)
          : 0;
        const flowId = flow?.id;

        return (
          <div key={good.id} style={{ marginBottom: 14 }}>
            {/* Header del bien */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: "#0A0A0A",
                    letterSpacing: 1.5,
                    fontFamily: FF,
                  }}
                >
                  {good.name.toUpperCase()}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    color: "#888",
                    fontFamily: FFM,
                  }}
                >
                  ({fmtMoney(good.baseCostPerUnit)}/u.)
                </span>
                {!isActive && (
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 800,
                      color: "#888",
                      letterSpacing: 1,
                      padding: "1px 6px",
                      border: "1.5px solid #AAA",
                      fontFamily: FF,
                    }}
                  >
                    INACTIVO
                  </span>
                )}
              </div>
              {isActive && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 1,
                    fontFamily: FFM,
                    color: pct < 50 ? "#FF2090" : "#0A0A0A",
                  }}
                >
                  {fmt(monthlyVolume)} / {fmt(targetVolume)} u. ({pct}%)
                </span>
              )}
            </div>

            {/* Barra de cobertura (solo si activo) */}
            {isActive && (
              <div
                style={{
                  height: 8,
                  background: "#F5F0E8",
                  border: "1.5px solid #0A0A0A",
                  marginBottom: 4,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, Math.max(0, pct))}%`,
                    background: pct >= 80 ? "#00C87E" : pct >= 50 ? "#E08800" : "#FF2090",
                  }}
                />
              </div>
            )}

            {/* Costo y sanciones (solo si activo) */}
            {isActive && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    color: "#888",
                    fontFamily: FFM,
                  }}
                >
                  Costo: {fmtMoney(monthlyCost)}
                  {sanctionsM > 1 && (
                    <span style={{ color: "#FF2090", marginLeft: 6 }}>
                      (sanción x{sanctionsM.toFixed(1)})
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Slider de volumen objetivo (siempre visible, crea decision pendiente) */}
            <div style={{ marginTop: 6 }}>
              <label
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#666",
                  letterSpacing: 1,
                  fontFamily: FF,
                  display: "block",
                  marginBottom: 2,
                }}
              >
                VOLUMEN OBJETIVO: {targetVolume.toFixed(0)} u. / mes
              </label>
              <input
                type="range"
                min={0}
                max={Math.ceil(demand * 2)}
                step={1}
                value={targetVolume}
                onChange={(e) => {
                  if (flowId) {
                    updateTradeFlowTarget(flowId, Number(e.target.value));
                  }
                }}
                style={{
                  width: "100%",
                  height: 6,
                  accentColor: !flowId ? "#AAA" : isActive ? "#2468CC" : "#2468CC",
                  opacity: !flowId ? 0.5 : 1,
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 8,
                  color: "#AAA",
                  fontFamily: FFM,
                }}
              >
                <span>0 u.</span>
                <span>
                  Demanda: {fmt(demand)} u.
                  {treasuryFactor < 1 && (
                    <span style={{ color: "#FF2090" }}>
                      {" "}
                      (factor {treasuryFactor.toFixed(2)})
                    </span>
                  )}
                </span>
                <span>{fmt(Math.ceil(demand * 2))} u.</span>
              </div>
              {!flowId && (
                <div
                  style={{
                    fontSize: 8,
                    color: "#AAA",
                    fontFamily: FFM,
                    marginTop: 2,
                    fontStyle: "italic",
                  }}
                >
                  Crea el flujo importando primero para activar el control.
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Badge de escasez */}
      {hasActiveImports && shortage && (
        <div
          style={{
            marginTop: 10,
            padding: "8px 12px",
            background: "#FF2090",
            color: "#FFFFFF",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 1.5,
            fontFamily: FF,
            border: "2px solid #0A0A0A",
          }}
        >
          ⚠ ESCASEZ DE MEDICAMENTOS — La cobertura de importación está por debajo
          del {Math.round(BALANCE.TRADE_SHORTAGE_COVERAGE_THRESHOLD * 100)}%,
          aumentando la mortalidad.
        </div>
      )}
    </div>
  );
}

// ─── Sub-componente celda estadistica ─────────────────────────────────────────

function StatCell({
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
        background: "#F5F0E8",
        border: "2px solid #0A0A0A",
        padding: "8px 10px",
      }}
    >
      <div
        style={{
          fontSize: 8,
          fontWeight: 700,
          color: "#888",
          letterSpacing: 1.5,
          fontFamily: FF,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color,
          fontFamily: FFM,
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
    </div>
  );
}
