import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice, formatRelative } from "@/lib/format";
import type { PriceSummary, PriceTrend } from "@/lib/types";

// "From" price with its unit and the number of quantity tiers.
export function PriceLine({ price, className }: { price: PriceSummary | null | undefined; className?: string }) {
  if (!price) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("whitespace-nowrap", className)}>
      <span className="font-semibold">{formatPrice(price.from_price, price.currency)}</span>
      {price.price_unit ? (
        <span className="text-xs text-muted-foreground">
          {" "}
          / {price.price_unit_quantity && price.price_unit_quantity !== "1" ? `${price.price_unit_quantity} ` : ""}
          {price.price_unit}
        </span>
      ) : null}
      {price.tiers > 1 ? <span className="text-xs text-muted-foreground"> · {price.tiers} tiers</span> : null}
    </span>
  );
}

// Last price movement: up in red, down in green (seen from the buyer).
export function PriceTrendBadge({ trend, currency = "EUR" }: { trend: PriceTrend | null | undefined; currency?: string }) {
  if (!trend || trend.change_percent === 0) return null;
  const up = trend.change_percent > 0;
  const Icon = up ? TrendingUpIcon : TrendingDownIcon;
  return (
    <span
      className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums", up ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700")}
      title={`Was ${formatPrice(trend.previous_price, currency)}, changed ${formatRelative(trend.changed_at)}`}
    >
      <Icon className="size-3" aria-hidden />
      {up ? "+" : "−"}
      {Math.abs(trend.change_percent).toFixed(1)}%
    </span>
  );
}
