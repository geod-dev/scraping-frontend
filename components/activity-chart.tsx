"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatNumber } from "@/lib/format";
import type { DailyStats } from "@/lib/types";

// Daily activity of the last days, one metric family at a time.
const VIEWS = {
  scraping: {
    label: "Scraping",
    config: {
      observations: { label: "Price observations", color: "#6366f1" },
      price_changes: { label: "Price changes", color: "#f59e0b" },
    },
  },
  catalog: {
    label: "Catalog",
    config: {
      products_created: { label: "New products", color: "#10b981" },
      products_marked_missing: { label: "Products gone missing", color: "#fb7185" },
    },
  },
  credits: {
    label: "Credits",
    config: { credits_used: { label: "Scrape.do credits", color: "#0ea5e9" } },
  },
  matching: {
    label: "Matching",
    config: {
      matches_auto: { label: "Automatic", color: "#0ea5e9" },
      matches_validated: { label: "Validated", color: "#10b981" },
      matches_rejected: { label: "Rejected", color: "#fb7185" },
    },
  },
  jobs: {
    label: "Jobs",
    config: {
      jobs_succeeded: { label: "Succeeded", color: "#10b981" },
      jobs_failed: { label: "Failed", color: "#f43f5e" },
    },
  },
} satisfies Record<string, { label: string; config: ChartConfig }>;

type View = keyof typeof VIEWS;

const dayLabel = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

export function ActivityChart({ daily }: { daily: DailyStats[] }) {
  const [view, setView] = useState<View>("scraping");
  const { config } = VIEWS[view];
  const keys = Object.keys(config) as (keyof DailyStats)[];
  const stacked = view === "matching" || view === "jobs";
  const totals = keys.map((key) => ({ key, total: daily.reduce((sum, d) => sum + Number(d[key] ?? 0), 0) }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={(v) => v && setView(v as View)} aria-label="Metric">
          {(Object.keys(VIEWS) as View[]).map((v) => (
            <ToggleGroupItem key={v} value={v} className="px-2.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              {VIEWS[v].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {totals.map(({ key, total }) => (
            <div key={key} className="flex items-baseline gap-1.5">
              <dt className="text-xs text-muted-foreground">{(config as ChartConfig)[key]?.label}</dt>
              <dd className="font-semibold tabular-nums">{formatNumber(total)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <ChartContainer config={config} className="aspect-auto h-60 w-full">
        <BarChart data={daily} margin={{ left: 0, right: 4, top: 4 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={dayLabel} />
          <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(value) => dayLabel(String(value))} />} />
          {keys.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null}
          {keys.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              fill={`var(--color-${key})`}
              stackId={stacked ? "day" : undefined}
              radius={stacked ? (i === keys.length - 1 ? [3, 3, 0, 0] : 0) : [3, 3, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </div>
  );
}
