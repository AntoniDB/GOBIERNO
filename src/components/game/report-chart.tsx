"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

export type ChartType = "line" | "area" | "bar";

export interface ChartSeries {
  dataKey: string;
  name: string;
  color: string;
  type?: ChartType;
}

interface ReportChartProps {
  title: string;
  data: Record<string, unknown>[];
  series: ChartSeries[];
  chartType?: ChartType;
  yAxisLabel?: string;
  valueFormatter?: (value: number) => string;
  domain?: [number, number];
  height?: number;
}

export function ReportChart({
  title,
  data,
  series,
  chartType = "line",
  yAxisLabel,
  valueFormatter,
  domain,
  height = 280,
}: ReportChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-heading font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent className="py-8">
          <p className="text-sm text-muted-foreground text-center">
            Avance mas meses para ver el historico.
          </p>
        </CardContent>
      </Card>
    );
  }

  const defaultFormatter = (value: number) => {
    if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(1);
  };

  const formatter = valueFormatter ?? defaultFormatter;

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 5, right: 10, bottom: 5, left: 0 },
    };

    const commonAxis = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-muted)" />
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
          axisLine={{ stroke: "var(--color-border)" }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={domain ?? ["auto", "auto"]}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
          axisLine={{ stroke: "var(--color-border)" }}
          tickLine={false}
          tickFormatter={formatter}
          width={55}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.5rem",
            color: "var(--color-foreground)",
            fontSize: "0.75rem",
          }}
          formatter={(value, name) => [
            formatter(Number(value)),
            String(name),
          ]}
          labelStyle={{ color: "var(--color-muted-foreground)", marginBottom: 4 }}
        />
        <Legend
          wrapperStyle={{ fontSize: "0.7rem", paddingTop: 8 }}
        />
      </>
    );

    if (chartType === "bar") {
      return (
        <BarChart {...commonProps}>
          {commonAxis}
          {series.map((s) => (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.name}
              fill={s.color}
              radius={[2, 2, 0, 0]}
            />
          ))}
        </BarChart>
      );
    }

    if (chartType === "area") {
      return (
        <AreaChart {...commonProps}>
          {commonAxis}
          {series.map((s) => (
            <Area
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      );
    }

    return (
      <LineChart {...commonProps}>
        {commonAxis}
        {series.map((s) => (
          <Line
            key={s.dataKey}
            type="monotone"
            dataKey={s.dataKey}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: s.color }}
          />
        ))}
      </LineChart>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-heading font-medium">{title}</CardTitle>
        {yAxisLabel && (
          <p className="text-xs text-muted-foreground">{yAxisLabel}</p>
        )}
      </CardHeader>
      <CardContent>
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
