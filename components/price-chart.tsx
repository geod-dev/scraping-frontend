"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatDateTime, formatPrice } from "@/lib/format";

export type PricePoint = { observedAt: string; price: number };
export type PriceSeriesInput = { label: string; points: PricePoint[] };

// Categorical slots in their fixed order (dataviz reference palette, light and dark steps).
// A series keeps its slot for as long as it is shown, so the order is never cycled.
const SLOTS = [
  { light: "#2a78d6", dark: "#3987e5" },
  { light: "#eb6834", dark: "#d95926" },
  { light: "#1baf7a", dark: "#199e70" },
  { light: "#eda100", dark: "#c98500" },
  { light: "#e87ba4", dark: "#d55181" },
  { light: "#008300", dark: "#008300" },
  { light: "#6250d6", dark: "#9085e9" },
  { light: "#e34948", dark: "#e66767" },
];

export const PRICE_SERIES_LIMIT = SLOTS.length;

type Row = { ts: number } & Record<string, number | boolean>;

const seriesKey = (index: number) => `series${index}`;

// Every series is drawn on the union of all capture times. Between two of its captures the price
// holds, and before its first or after its last capture it keeps that first or last price.
function alignSeries(series: PriceSeriesInput[]): Row[] {
  const times = [...new Set(series.flatMap((s) => s.points.map((p) => new Date(p.observedAt).getTime())))].sort((a, b) => a - b);
  const rows = times.map((ts) => ({ ts }) as Row);
  series.forEach((s, i) => {
    if (s.points.length === 0) return;
    const key = seriesKey(i);
    const captured = new Map(s.points.map((p) => [new Date(p.observedAt).getTime(), p.price]));
    let current = s.points[0].price;
    rows.forEach((row, r) => {
      const price = captured.get(times[r]);
      if (price !== undefined) current = price;
      row[key] = current;
      row[`${key}_observed`] = price !== undefined;
    });
  });
  return rows;
}

// A dot only where the series was really captured; held values stay bare line.
function observedDot(key: string) {
  return function ObservedDot({ cx, cy, index, payload }: { cx?: number; cy?: number; index?: number; payload?: Row }) {
    if (cx === undefined || cy === undefined || !payload?.[`${key}_observed`]) return <g key={index} />;
    return <circle key={index} cx={cx} cy={cy} r={4} fill={`var(--color-${key})`} stroke="var(--card)" strokeWidth={2} />;
  };
}

export function PriceChart({ series, currency }: { series: PriceSeriesInput[]; currency: string }) {
  const rows = alignSeries(series);
  const config = Object.fromEntries(series.map((s, i) => [seriesKey(i), { label: s.label, theme: SLOTS[i] }])) as ChartConfig;

  return (
    <div className="space-y-4">
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="ts"
            type="number"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tickFormatter={(v: number) => new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => formatPrice(v, currency)}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={96}
          />
          <ChartTooltip
            cursor={{ stroke: "var(--border)" }}
            content={
              <ChartTooltipContent
                labelFormatter={(v) => formatDateTime(new Date(Number(v)).toISOString())}
                formatter={(value, name, item) => {
                  const captured = (item.payload as Row | undefined)?.[`${String(name)}_observed`] === true;
                  return (
                    <span className="flex flex-1 items-center justify-between gap-3">
                      <span className="font-semibold tabular-nums">{formatPrice(Number(value), currency)}</span>
                      {captured ? null : <span className="text-xs text-muted-foreground">no capture</span>}
                    </span>
                  );
                }}
              />
            }
          />
          {series.map((_, i) => {
            const key = seriesKey(i);
            return (
              <Line
                key={key}
                type="stepAfter"
                dataKey={key}
                stroke={`var(--color-${key})`}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={observedDot(key)}
                activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            );
          })}
        </LineChart>
      </ChartContainer>

      {series.length > 1 ? (
        // Legend for identity (the color mark), latest price as text: the reference values of the chart.
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
          {series.map((s, i) => {
            const latest = s.points.at(-1);
            return (
              <li key={seriesKey(i)} className="flex min-w-0 items-center gap-2">
                <span aria-hidden className="h-0.5 w-4 shrink-0 rounded-full" style={{ backgroundColor: `var(--color-${seriesKey(i)})` }} />
                <span className="min-w-0 truncate text-foreground/80">{s.label}</span>
                <span className="ml-auto shrink-0 pl-2 font-medium tabular-nums">{latest ? formatPrice(latest.price, currency) : "—"}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
