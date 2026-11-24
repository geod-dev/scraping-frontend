import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice, formatRelative } from "@/lib/format";
import type { ApiPrice, PriceSummary, PriceTrend } from "@/lib/types";

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

// Antalis unit codes (order and price units of the pricing API).
const API_UNITS: Record<string, string> = {
  ST: "piece",
  ZSH: "sheet",
  ZRM: "ream",
  PAL: "pallet",
  ROL: "roll",
  ZBL: "bundle",
  KAR: "carton",
  ZBX: "box",
};

export function apiUnitLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return API_UNITS[code.toUpperCase()] ?? code;
}

// Customer price from the pricing API: "€ 92.35 / 1000 sheet", or the reason the API gave none.
export function ApiPriceLine({ price, className, compact }: { price: ApiPrice | null | undefined; className?: string; compact?: boolean }) {
  if (!price) return <span className="text-muted-foreground">—</span>;
  if (price.unit_price === null || Number(price.unit_price) === 0) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)} title={price.error_code ? `API error ${price.error_code}` : undefined}>
        {compact ? "Not priced" : `Not priced by the API: ${price.error_message ?? price.error_code ?? "no price"}`}
      </span>
    );
  }
  const unit = apiUnitLabel(price.price_unit);
  return (
    <span className={cn("whitespace-nowrap", className)}>
      <span className="font-semibold">{formatPrice(price.unit_price, price.currency ?? "EUR")}</span>
      {unit ? (
        <span className="text-xs text-muted-foreground">
          {" "}
          / {price.price_quantity && Number(price.price_quantity) !== 1 ? `${Number(price.price_quantity)} ` : ""}
          {unit}
        </span>
      ) : null}
      {!compact && price.discount_percent && Number(price.discount_percent) !== 0 ? (
        <span className="text-xs text-muted-foreground"> · −{Number(price.discount_percent)}% off list</span>
      ) : null}
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
