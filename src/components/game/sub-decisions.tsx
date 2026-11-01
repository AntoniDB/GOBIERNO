"use client";

import { useMemo } from "react";
import { useGameStore } from "@/lib/store/game-store";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { numberRange } from "@/lib/engine/sub-decisions";
import { subDecisionDeltas, describeSubDecisionEffects, suppressedSubDecisions } from "@/lib/engine/sub-decision-effects";
import { calculateTaxRevenue } from "@/lib/engine/economy";
import { debtAnnualRate, debtToGdp, monthlyDebtInterest } from "@/lib/engine/fiscal";
import { interestBurden, ratingFromScore, ratingSpread } from "@/lib/engine/rating";
import { isDebtCrisisOpen } from "@/lib/engine/debt-crisis";
import { exchangeRateOf, monthlyOtherImports, tariffRevenueDelta } from "@/lib/engine/foreign-trade";
import {
  centralBank, isCentralBankAutonomous, monetaryCredibility, monetaryEmission, policyRate, taylorRate,
} from "@/lib/engine/monetary";
import { BALANCE } from "@/lib/balance";

interface SubDecisionsProps {
  ministryKey: string;
  subDecisions: Record<string, number | boolean>;
  onSubDecisionChange: (ministryKey: string, key: string, value: number | boolean) => void;
}

function ToggleControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm text-foreground">{label}</Label>
      <Button
        variant={value ? "default" : "outline"}
        size="xs"
        onClick={() => onChange(!value)}
      >
        {value ? "Activado" : "Desactivado"}
      </Button>
    </div>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  leftLabel,
  rightLabel,
  disabled,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  leftLabel?: string;
  rightLabel?: string;
  /** Bloqueado (p. ej. lo decide el Banco Central) */
  disabled?: boolean;
  /** Nota bajo el control */
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm text-foreground">{label}</Label>
        <span className="text-sm font-medium tabular-nums text-muted-foreground">
          {value.toFixed(step && step < 1 ? 1 : 0)}{unit ?? ""}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step ?? 1}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
        disabled={disabled}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {(leftLabel || rightLabel) && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{leftLabel ?? ""}</span>
          <span>{rightLabel ?? ""}</span>
        </div>
      )}
    </div>
  );
}

function NumberInputControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm text-foreground">{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(e) => {
          const parsed = parseFloat(e.target.value);
          // Lo escrito a mano puede salirse del rango: se acota igual que en el motor
          if (!isNaN(parsed)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed)));
        }}
      />
    </div>
  );
}

function HealthDecisions({
  subDecisions,
  onChange,
}: {
  subDecisions: Record<string, number | boolean>;
  onChange: (key: string, value: number | boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <SliderControl
        label="Balance hospitales públicos/privados"
        value={(subDecisions.hospitalesPublicos as number) ?? 50}
        min={0}
        max={100}
        onChange={(v) => onChange("hospitalesPublicos", v)}
        leftLabel="100% Privado"
        rightLabel="100% Público"
      />
      <ToggleControl
        label="Campañas de vacunación"
        value={(subDecisions.vacunacion as boolean) ?? false}
        onChange={(v) => onChange("vacunacion", v)}
      />
      <ToggleControl
        label="Enfoque en salud mental"
        value={(subDecisions.saludMental as boolean) ?? false}
        onChange={(v) => onChange("saludMental", v)}
      />
    </div>
  );
}

function EducationDecisions({
  subDecisions,
  onChange,
}: {
  subDecisions: Record<string, number | boolean>;
  onChange: (key: string, value: number | boolean) => void;
}) {
  const primaria = (subDecisions.primaria as number) ?? 33;
  const secundaria = (subDecisions.secundaria as number) ?? 33;
  const superior = (subDecisions.superior as number) ?? 34;
  const total = primaria + secundaria + superior;
  const balanced = Math.abs(total - 100) < 0.5;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground">Inversión por etapa educativa</Label>
          <span className={`text-xs font-medium tabular-nums ${balanced ? "text-accent" : "text-destructive"}`}>
            Total: {total.toFixed(0)}% {!balanced && "(debe ser 100%)"}
          </span>
        </div>
        <SliderControl
          label="Primaria"
          value={primaria}
          min={0}
          max={100}
          onChange={(v) => onChange("primaria", v)}
        />
        <SliderControl
          label="Secundaria"
          value={secundaria}
          min={0}
          max={100}
          onChange={(v) => onChange("secundaria", v)}
        />
        <SliderControl
          label="Superior"
          value={superior}
          min={0}
          max={100}
          onChange={(v) => onChange("superior", v)}
        />
      </div>
      <SliderControl
        label="Enfoque curricular STEM vs Humanidades"
        value={(subDecisions.enfoqueSTEM as number) ?? 50}
        min={0}
        max={100}
        onChange={(v) => onChange("enfoqueSTEM", v)}
        leftLabel="Humanidades"
        rightLabel="STEM"
      />
      <ToggleControl
        label="Becas estudiantiles"
        value={(subDecisions.becas as boolean) ?? false}
        onChange={(v) => onChange("becas", v)}
      />
    </div>
  );
}

function EconomyDecisions({
  subDecisions,
  onChange,
}: {
  subDecisions: Record<string, number | boolean>;
  onChange: (key: string, value: number | boolean) => void;
}) {
  // Un Banco Central autónomo decide la tasa y no emite: los controles quedan bloqueados
  const organisms = useGameStore((s) => s.gameState?.organisms);
  const bankName = useMemo(
    () => (organisms && isCentralBankAutonomous(organisms) ? centralBank(organisms)?.name : undefined),
    [organisms],
  );
  const lockedHint = bankName ? `Lo decide ${bankName} (autónomo).` : undefined;
  return (
    <div className="space-y-5">
      <SliderControl
        label="Tasa de interés referencial"
        value={(subDecisions.tasaInteres as number) ?? 5}
        min={1}
        max={20}
        step={0.5}
        unit="%"
        onChange={(v) => onChange("tasaInteres", v)}
        disabled={!!bankName}
        hint={lockedHint}
      />
      <NumberInputControl
        label="Salario mínimo (USD)"
        value={(subDecisions.salarioMinimo as number) ?? 300}
        {...numberRange("ECONOMY", "salarioMinimo")}
        onChange={(v) => onChange("salarioMinimo", v)}
      />
      <SliderControl
        label="Política industrial"
        value={(subDecisions.politicaIndustrial as number) ?? 50}
        min={0}
        max={100}
        onChange={(v) => onChange("politicaIndustrial", v)}
        leftLabel="Proteccionismo"
        rightLabel="Apertura total"
      />
      <SliderControl
        label="IVA"
        value={(subDecisions.iva as number) ?? 16}
        min={0}
        max={30}
        step={0.5}
        unit="%"
        onChange={(v) => onChange("iva", v)}
      />
      <SliderControl
        label="Impuesto a la renta (tasa máxima)"
        value={(subDecisions.impuestoRenta as number) ?? 25}
        min={0}
        max={50}
        unit="%"
        onChange={(v) => onChange("impuestoRenta", v)}
      />
      <SliderControl
        label="Impuesto a las sociedades"
        value={(subDecisions.impuestoSociedades as number) ?? 25}
        min={0}
        max={45}
        unit="%"
        onChange={(v) => onChange("impuestoSociedades", v)}
      />
      <SliderControl
        label="Emisión monetaria (% de la recaudación por mes)"
        value={(subDecisions.emisionMonetaria as number) ?? 0}
        min={0}
        max={30}
        unit="%"
        onChange={(v) => onChange("emisionMonetaria", v)}
        disabled={!!bankName}
        hint={lockedHint ?? "Financia al Estado imprimiendo dinero: sube la inflación de los meses siguientes."}
      />
      <SliderControl
        label="Aranceles a la importación"
        value={(subDecisions.aranceles as number) ?? 10}
        min={0}
        max={40}
        unit="%"
        onChange={(v) => onChange("aranceles", v)}
        hint="Más aranceles: más ingreso y protección industrial, pero encarecen las importaciones y los socios responden bajando tus exportaciones."
      />
      <SliderControl
        label="Intervención cambiaria"
        value={(subDecisions.intervencionCambiaria as number) ?? 0}
        min={0}
        max={100}
        step={5}
        unit="%"
        onChange={(v) => onChange("intervencionCambiaria", v)}
        leftLabel="Flotación libre"
        rightLabel="Tipo de cambio fijo"
        hint="Frena los movimientos de la moneda, pero cada mes cuesta tesoro."
      />
    </div>
  );
}

/**
 * Resumen fiscal de Economía: recaudación estimada con las tasas propuestas frente a las vigentes,
 * evasión y deuda pública. Usa las mismas funciones puras que el motor.
 */
function FiscalSummary({ subDecisions }: { subDecisions: Record<string, number | boolean> }) {
  const gameState = useGameStore((s) => s.gameState);
  const summary = useMemo(() => {
    if (!gameState) return null;
    const current = calculateTaxRevenue(gameState);
    const proposedMinistries = gameState.ministries.map((m) =>
      m.key === "ECONOMY" ? { ...m, subDecisions: { ...m.subDecisions, ...subDecisions } } : m,
    );
    const proposed = calculateTaxRevenue({ ...gameState, ministries: proposedMinistries });
    const debt = gameState.publicDebt ?? 0;
    return {
      inflation: gameState.inflation,
      exportsLast: gameState.totalExports ?? 0,
      importsLast: gameState.totalImports ?? 0,
      balance: gameState.tradeBalance ?? 0,
      fx: exchangeRateOf(gameState),
      tariffNet: tariffRevenueDelta(
        proposedMinistries,
        monthlyOtherImports({ ministries: proposedMinistries, exchangeRate: gameState.exchangeRate }, (gameState.gdp ?? 0) / 12),
      ),
      credibility: monetaryCredibility(gameState.organisms ?? []),
      taylor: taylorRate(gameState.inflation),
      rate: policyRate(proposedMinistries),
      emission: monetaryEmission(proposedMinistries, proposed.revenue),
      current: current.revenue,
      proposed: proposed.revenue,
      evasion: proposed.evasion,
      debt,
      debtRatio: debtToGdp(debt, gameState.gdp),
      debtRate: debtAnnualRate(gameState),
      rating: ratingFromScore(gameState.creditScore),
      spread: ratingSpread(gameState.creditScore),
      burden: interestBurden(monthlyDebtInterest(gameState), current.revenue),
      crisisOpen: isDebtCrisisOpen(gameState),
      crisisMonths: gameState.debtCrisisMonths ?? 0,
      marketsClosed: gameState.marketsClosedMonths ?? 0,
    };
  }, [gameState, subDecisions]);
  const response = useGameStore((s) => s.pendingInput.debtCrisisResponse);
  const setResponse = useGameStore((s) => s.setDebtCrisisResponse);
  if (!summary) return null;
  const fmt = (n: number) => `M$ ${(n / 1_000_000).toFixed(1)}`;
  const graceLeft = Math.max(0, BALANCE.DEBT_CRISIS_GRACE_MONTHS + 1 - summary.crisisMonths);
  const diff = summary.proposed - summary.current;
  return (
    <div className="border-t border-border pt-3 space-y-1 text-xs">
      {summary.crisisOpen && (
        <div className="mb-3 space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
          <p className="font-medium text-destructive">Crisis de deuda: los mercados dejaron de prestar</p>
          <p className="text-muted-foreground">
            Los intereses consumen {Number.isFinite(summary.burden) ? Math.round(summary.burden * 100) : 100}% de la recaudación. Si no
            respondes en {graceLeft} mes{graceLeft === 1 ? "" : "es"}, el país cae en default automático.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="xs"
              variant={response === "AUSTERITY" ? "default" : "outline"}
              onClick={() => setResponse(response === "AUSTERITY" ? null : "AUSTERITY")}
            >
              Austeridad (−{Math.round(BALANCE.AUSTERITY_BUDGET_CUT * 100)}% presupuestos)
            </Button>
            <Button
              size="xs"
              variant={response === "DEFAULT" ? "destructive" : "outline"}
              onClick={() => setResponse(response === "DEFAULT" ? null : "DEFAULT")}
            >
              Declarar default (−{Math.round(BALANCE.DEFAULT_HAIRCUT * 100)}% de la deuda)
            </Button>
          </div>
          <p className="text-muted-foreground">
            Austeridad: recorta todos los presupuestos, baja la aprobación y calma a los mercados. Default: quita de la deuda, calificación D,
            mercados cerrados {BALANCE.DEFAULT_MARKET_CLOSURE_MONTHS} meses (el déficit se financia imprimiendo dinero) y sanciones.
            Se aplica al avanzar el mes.
          </p>
        </div>
      )}
      {summary.marketsClosed > 0 && (
        <p className="mb-2 text-destructive">
          Mercados cerrados {summary.marketsClosed} mes{summary.marketsClosed === 1 ? "" : "es"} más tras el default: no hay deuda nueva,
          el déficit se cubre imprimiendo dinero.
        </p>
      )}
      <p className="font-medium text-muted-foreground">Política fiscal</p>
      <div className="flex justify-between gap-2">
        <span>Recaudación estimada</span>
        <span className="font-mono tabular-nums">
          {fmt(summary.proposed)}/mes
          {Math.abs(diff) >= 50_000 && ` (${diff > 0 ? "+" : "−"}${fmt(Math.abs(diff))})`}
        </span>
      </div>
      <div className="flex justify-between gap-2">
        <span>Evasión fiscal</span>
        <span className="font-mono tabular-nums">{(summary.evasion * 100).toFixed(1)}%</span>
      </div>
      <div className="flex justify-between gap-2">
        <span>Emisión monetaria</span>
        <span className="font-mono tabular-nums">{fmt(summary.emission)}/mes</span>
      </div>
      <div className="flex justify-between gap-2">
        <span>Deuda pública</span>
        <span className="font-mono tabular-nums">
          {fmt(summary.debt)} ({(summary.debtRatio * 100).toFixed(1)}% del PIB, {(summary.debtRate * 100).toFixed(1)}% anual)
        </span>
      </div>
      <div className="flex justify-between gap-2">
        <span>Calificación crediticia</span>
        <span className="font-mono tabular-nums">
          {summary.rating ?? "—"}{summary.rating ? ` (+${(summary.spread * 100).toFixed(1)}% de diferencial)` : ""}
        </span>
      </div>
      <div className="flex justify-between gap-2">
        <span>Intereses / recaudación</span>
        <span className="font-mono tabular-nums">
          {Number.isFinite(summary.burden) ? `${(summary.burden * 100).toFixed(1)}%` : "—"} (crisis desde {Math.round(BALANCE.DEBT_CRISIS_INTEREST_BURDEN * 100)}%)
        </span>
      </div>
      <p className="font-medium text-muted-foreground pt-2">Comercio exterior</p>
      <div className="flex justify-between gap-2">
        <span>Exportaciones / importaciones (último mes)</span>
        <span className="font-mono tabular-nums">{fmt(summary.exportsLast)} / {fmt(summary.importsLast)}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span>Balanza comercial</span>
        <span className={`font-mono tabular-nums ${summary.balance < 0 ? "text-destructive" : ""}`}>
          {summary.balance < 0 ? "−" : "+"}{fmt(Math.abs(summary.balance))}
        </span>
      </div>
      <div className="flex justify-between gap-2">
        <span>Tipo de cambio (100 = inicial; más alto = moneda más débil)</span>
        <span className="font-mono tabular-nums">{summary.fx.toFixed(1)}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span>Ingreso arancelario neto vs. inicial (estimado)</span>
        <span className="font-mono tabular-nums">{summary.tariffNet < 0 ? "−" : "+"}{fmt(Math.abs(summary.tariffNet))}/mes</span>
      </div>
      <p className="font-medium text-muted-foreground pt-2">Política monetaria</p>
      <div className="flex justify-between gap-2">
        <span>Inflación anual (meta {BALANCE.INFLATION_TARGET}%)</span>
        <span className="font-mono tabular-nums">{summary.inflation.toFixed(1)}%</span>
      </div>
      <div className="flex justify-between gap-2">
        <span>Tasa vigente / regla de Taylor</span>
        <span className="font-mono tabular-nums">{summary.rate.toFixed(1)}% / {summary.taylor.toFixed(1)}%</span>
      </div>
      <div className="flex justify-between gap-2">
        <span>Credibilidad monetaria</span>
        <span className="font-mono tabular-nums">{Math.round(summary.credibility * 100)}%</span>
      </div>
    </div>
  );
}

function DefenseDecisions({
  subDecisions,
  onChange,
}: {
  subDecisions: Record<string, number | boolean>;
  onChange: (key: string, value: number | boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <NumberInputControl
        label="Tropas activas"
        value={(subDecisions.tropasActivas as number) ?? 50000}
        {...numberRange("DEFENSE", "tropasActivas")}
        onChange={(v) => onChange("tropasActivas", v)}
      />
      <SliderControl
        label="Gasto en equipamiento"
        value={(subDecisions.gastoEquipamiento as number) ?? 50}
        min={0}
        max={100}
        unit="%"
        onChange={(v) => onChange("gastoEquipamiento", v)}
      />
      <ToggleControl
        label="Servicio militar obligatorio"
        value={(subDecisions.servicioMilitar as boolean) ?? false}
        onChange={(v) => onChange("servicioMilitar", v)}
      />
    </div>
  );
}

function SecurityDecisions({
  subDecisions,
  onChange,
}: {
  subDecisions: Record<string, number | boolean>;
  onChange: (key: string, value: number | boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <SliderControl
        label="Patrullaje urbano vs rural"
        value={(subDecisions.patrullajeUrbano as number) ?? 50}
        min={0}
        max={100}
        onChange={(v) => onChange("patrullajeUrbano", v)}
        leftLabel="Rural"
        rightLabel="Urbano"
      />
      <SliderControl
        label="Política antidrogas"
        value={(subDecisions.politicaDrogas as number) ?? 50}
        min={0}
        max={100}
        onChange={(v) => onChange("politicaDrogas", v)}
        leftLabel="Represiva"
        rightLabel="Preventiva"
      />
      <SliderControl
        label="Inversión en sistema carcelario"
        value={(subDecisions.inversionCarceles as number) ?? 50}
        min={0}
        max={100}
        unit="%"
        onChange={(v) => onChange("inversionCarceles", v)}
      />
    </div>
  );
}

function JusticeDecisions({
  subDecisions,
  onChange,
}: {
  subDecisions: Record<string, number | boolean>;
  onChange: (key: string, value: number | boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <NumberInputControl
        label="Jueces y fiscales contratados"
        value={(subDecisions.juecesContratados as number) ?? 500}
        {...numberRange("JUSTICE", "juecesContratados")}
        onChange={(v) => onChange("juecesContratados", v)}
      />
      <SliderControl
        label="Prioridad corrupción vs crimen común"
        value={(subDecisions.prioridadCorrupcion as number) ?? 50}
        min={0}
        max={100}
        onChange={(v) => onChange("prioridadCorrupcion", v)}
        leftLabel="Crimen común"
        rightLabel="Corrupción"
      />
      <SliderControl
        label="Dureza penal"
        value={(subDecisions.durezaPenal as number) ?? 50}
        min={0}
        max={100}
        onChange={(v) => onChange("durezaPenal", v)}
        leftLabel="Garantista"
        rightLabel="Punitiva máxima"
      />
    </div>
  );
}

function AgricultureDecisions({
  subDecisions,
  onChange,
}: {
  subDecisions: Record<string, number | boolean>;
  onChange: (key: string, value: number | boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <SliderControl
        label="Subsidios al pequeño productor vs grandes empresas"
        value={(subDecisions.subsidioPequenoProductor as number) ?? 50}
        min={0}
        max={100}
        onChange={(v) => onChange("subsidioPequenoProductor", v)}
        leftLabel="Grandes empresas"
        rightLabel="Pequeño productor"
      />
      <SliderControl
        label="Inversión en infraestructura rural"
        value={(subDecisions.infraestructuraRural as number) ?? 50}
        min={0}
        max={100}
        unit="%"
        onChange={(v) => onChange("infraestructuraRural", v)}
      />
    </div>
  );
}

function SocialDevelopmentDecisions({
  subDecisions,
  onChange,
}: {
  subDecisions: Record<string, number | boolean>;
  onChange: (key: string, value: number | boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <SliderControl
        label="Focalización vs universalidad de programas"
        value={(subDecisions.focalizacion as number) ?? 50}
        min={0}
        max={100}
        onChange={(v) => onChange("focalizacion", v)}
        leftLabel="Focalizado"
        rightLabel="Universal"
      />
      <SliderControl
        label="Prioridad: Niñez"
        value={(subDecisions.prioridadNinos as number) ?? 25}
        min={0}
        max={100}
        unit="%"
        onChange={(v) => onChange("prioridadNinos", v)}
      />
      <SliderControl
        label="Prioridad: Adultos mayores"
        value={(subDecisions.prioridadAdultosMayores as number) ?? 25}
        min={0}
        max={100}
        unit="%"
        onChange={(v) => onChange("prioridadAdultosMayores", v)}
      />
      <SliderControl
        label="Prioridad: Mujeres"
        value={(subDecisions.prioridadMujeres as number) ?? 25}
        min={0}
        max={100}
        unit="%"
        onChange={(v) => onChange("prioridadMujeres", v)}
      />
    </div>
  );
}

export function SubDecisions({ ministryKey, subDecisions, onSubDecisionChange }: SubDecisionsProps) {
  const pendingInput = useGameStore((s) => s.pendingInput);

  // Fusionar valores pendientes sobre los del estado del juego.
  // El slider de Radix es controlado: necesita ver el valor pendiente
  // para que el thumb no rebote a la posición original al soltar.
  const effectiveSubDecisions = useMemo(() => {
    const pending = pendingInput.subDecisionChanges?.[ministryKey] ?? {};
    return { ...subDecisions, ...pending };
  }, [subDecisions, pendingInput.subDecisionChanges, ministryKey]);

  const handleChange = (key: string, value: number | boolean) => {
    onSubDecisionChange(ministryKey, key, value);
  };

  // Efecto de la configuración actual de este ministerio respecto del punto de partida
  const population = useGameStore((s) => s.gameState?.population);
  const programs = useGameStore((s) => s.gameState?.programs);
  const activeLaws = useGameStore((s) => s.gameState?.activeLaws);
  const context = useMemo(() => ({ programs, activeLaws }), [programs, activeLaws]);
  const effects = useMemo(
    () =>
      population
        ? describeSubDecisionEffects(subDecisionDeltas([{ key: ministryKey, subDecisions: effectiveSubDecisions }], population, context))
        : [],
    [ministryKey, effectiveSubDecisions, population, context],
  );
  // Sub-decisiones cuyo efecto reemplaza hoy un programa o una ley (se avisa para no engañar)
  const suppressed = useMemo(
    () => suppressedSubDecisions({ key: ministryKey, subDecisions: effectiveSubDecisions }, context),
    [ministryKey, effectiveSubDecisions, context],
  );
  const fmtEffect = (e: { value: number; kind: string }) =>
    e.kind === "cost"
      ? `${e.value > 0 ? "+" : "−"}M$ ${(Math.abs(e.value) / 1_000_000).toFixed(1)}/mes`
      : `${e.value > 0 ? "+" : "−"}${Math.abs(e.value).toFixed(e.kind === "indicator" && Math.abs(e.value) < 0.1 ? 3 : 1)}`;

  const renderDecisions = () => {
    switch (ministryKey) {
      case "HEALTH":
        return <HealthDecisions subDecisions={effectiveSubDecisions} onChange={handleChange} />;
      case "EDUCATION":
        return <EducationDecisions subDecisions={effectiveSubDecisions} onChange={handleChange} />;
      case "ECONOMY":
        return <EconomyDecisions subDecisions={effectiveSubDecisions} onChange={handleChange} />;
      case "DEFENSE":
        return <DefenseDecisions subDecisions={effectiveSubDecisions} onChange={handleChange} />;
      case "SECURITY":
        return <SecurityDecisions subDecisions={effectiveSubDecisions} onChange={handleChange} />;
      case "JUSTICE":
        return <JusticeDecisions subDecisions={effectiveSubDecisions} onChange={handleChange} />;
      case "AGRICULTURE":
        return <AgricultureDecisions subDecisions={effectiveSubDecisions} onChange={handleChange} />;
      case "SOCIAL_DEVELOPMENT":
        return <SocialDevelopmentDecisions subDecisions={effectiveSubDecisions} onChange={handleChange} />;
      default:
        return <p className="text-sm text-muted-foreground">Sin decisiones configuradas para este ministerio.</p>;
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="text-sm font-heading font-medium text-foreground">Decisiones de política</h3>
      {renderDecisions()}
      {ministryKey === "ECONOMY" && <FiscalSummary subDecisions={effectiveSubDecisions} />}
      <div className="border-t border-border pt-3 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          Efecto de esta configuración (respecto del punto de partida)
        </p>
        {suppressed.length > 0 && (
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {suppressed.map((s) => (
              <li key={s.key}>{s.notice}</li>
            ))}
          </ul>
        )}
        {effects.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin cambios: los indicadores no se alteran.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
            {effects.map((e) => (
              <li key={e.label} className="flex justify-between gap-2">
                <span>{e.label}</span>
                <span className="font-mono tabular-nums">{fmtEffect(e)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
