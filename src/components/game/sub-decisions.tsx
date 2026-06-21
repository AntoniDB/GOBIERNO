"use client";

import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
      />
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
  step,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm text-foreground">{label}</Label>
      <Input
        type="number"
        min={min}
        step={step ?? 1}
        value={value}
        onChange={(e) => {
          const parsed = parseFloat(e.target.value);
          if (!isNaN(parsed)) onChange(parsed);
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
      />
      <NumberInputControl
        label="Salario mínimo (USD)"
        value={(subDecisions.salarioMinimo as number) ?? 300}
        min={1}
        step={10}
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
        min={0}
        step={1000}
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
        min={0}
        step={10}
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
  const handleChange = (key: string, value: number | boolean) => {
    onSubDecisionChange(ministryKey, key, value);
  };

  const renderDecisions = () => {
    switch (ministryKey) {
      case "HEALTH":
        return <HealthDecisions subDecisions={subDecisions} onChange={handleChange} />;
      case "EDUCATION":
        return <EducationDecisions subDecisions={subDecisions} onChange={handleChange} />;
      case "ECONOMY":
        return <EconomyDecisions subDecisions={subDecisions} onChange={handleChange} />;
      case "DEFENSE":
        return <DefenseDecisions subDecisions={subDecisions} onChange={handleChange} />;
      case "SECURITY":
        return <SecurityDecisions subDecisions={subDecisions} onChange={handleChange} />;
      case "JUSTICE":
        return <JusticeDecisions subDecisions={subDecisions} onChange={handleChange} />;
      case "AGRICULTURE":
        return <AgricultureDecisions subDecisions={subDecisions} onChange={handleChange} />;
      case "SOCIAL_DEVELOPMENT":
        return <SocialDevelopmentDecisions subDecisions={subDecisions} onChange={handleChange} />;
      default:
        return <p className="text-sm text-muted-foreground">Sin decisiones configuradas para este ministerio.</p>;
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="text-sm font-heading font-medium text-foreground">Decisiones de política</h3>
      {renderDecisions()}
    </div>
  );
}
