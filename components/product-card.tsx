import Link from "next/link";
import { ToneBadge } from "@/components/kit";
import { PriceLine, PriceTrendBadge } from "@/components/price";
import { ProductThumb } from "@/components/product-thumb";
import { Card } from "@/components/ui/card";
import { firstImage } from "@/lib/images";
import type { ProductListItem } from "@/lib/types";

// Catalog card: image first, then competitor, title, brand and reference, price and trend.
export function ProductCard({ product: p, competitor }: { product: ProductListItem; competitor?: string }) {
  return (
    <Link href={`/products/${p.id}`} className="group block h-full">
      <Card className="h-full gap-0 py-0 transition group-hover:shadow-md group-hover:ring-primary/30">
        <div className="relative">
          <ProductThumb src={firstImage(p.images)} alt={p.title ?? ""} size="fill" className="rounded-none rounded-t-xl border-0 border-b" />
          {p.status === "missing" ? (
            <ToneBadge tone="danger" className="absolute top-2 left-2">
              Missing
            </ToneBadge>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <p className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{competitor ?? "—"}</p>
          <p className="line-clamp-2 text-sm leading-snug font-medium group-hover:text-primary">{p.title ?? "Untitled product"}</p>
          <p className="truncate text-xs text-muted-foreground">{[p.brand, p.catalog_reference].filter(Boolean).join(" · ") || " "}</p>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-1 pt-2">
            <PriceLine price={p.latest_price} className="text-sm" />
            <PriceTrendBadge trend={p.price_trend} currency={p.latest_price?.currency} />
          </div>
        </div>
      </Card>
    </Link>
  );
}
