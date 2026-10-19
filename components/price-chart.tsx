"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDateTime, formatPrice } from "@/lib/format";

export type PricePoint = { observedAt: string; price: number; promotional?: boolean };

export function PriceChart({ points, currency }: { points: PricePoint[]; currency: string }) {
  const data = points.map((p) => ({ ts: new Date(p.observedAt).getTime(), price: p.price, observedAt: p.observedAt }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="ts"
            type="number"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tickFormatter={(v: number) => new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
            tick={{ fontSize: 12, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            dataKey="price"
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => formatPrice(v, currency)}
            tick={{ fontSize: 12, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            width={96}
          />
          <Tooltip
            labelFormatter={(v) => formatDateTime(new Date(Number(v)).toISOString())}
            formatter={(value) => [formatPrice(Number(value), currency), "Price"]}
            contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 13 }}
          />
          <Line type="stepAfter" dataKey="price" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
