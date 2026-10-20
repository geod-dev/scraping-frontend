import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLinkIcon } from "lucide-react";
import { ImageGallery } from "@/components/image-gallery";
import { ApiUnavailable, DefinitionList, EmptyState, KeyValueList, PageHeader, Panel, PanelLink, RowChevron, StatusBadge, ToneBadge } from "@/components/kit";
import { LinkRow } from "@/components/link-row";
import { MatchStatusBadge, ProductCell, ScoreRing } from "@/components/matching";
import { PriceLine, PriceTrendBadge } from "@/components/price";
import { PriceChart, type PricePoint } from "@/components/price-chart";
import { ProductThumb } from "@/components/product-thumb";
import { ReadMore } from "@/components/read-more";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch, isApiError, settle } from "@/lib/api";
import { formatDateTime, formatNumber, formatPrice, formatRelative, labelize } from "@/lib/format";
import { firstImage, productImages } from "@/lib/images";
import { scoreThresholds } from "@/lib/matching";
import { cn } from "@/lib/utils";
import type { Competitor, MatchListItem, MatchingConfig, Observation, Paginated, PriceSummary, ProductDetail } from "@/lib/types";

const ASSOCIATED_LIMIT = 20;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Product ${id}` };
}

// One point per observation time: the lowest unit price seen at that time.
function toChartPoints(history: Observation[]): PricePoint[] {
  const byTime = new Map<string, { price: number; promotional: boolean }>();
  for (const obs of history) {
    const price = Number(obs.price);
    if (Number.isNaN(price)) continue;
    const current = byTime.get(obs.observed_at);
    if (!current || price < current.price) byTime.set(obs.observed_at, { price, promotional: obs.is_promotional === true });
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([observedAt, v]) => ({ observedAt, price: v.price, promotional: v.promotional }));
}

// Relative gap of a competitor price with the Antalis price, on the "from" price of each.
function priceGap(price: PriceSummary | null | undefined, reference: PriceSummary | null | undefined): number | null {
  const a = Number(price?.from_price);
  const b = Number(reference?.from_price);
  if (!price || !reference || !Number.isFinite(a) || !Number.isFinite(b) || b === 0 || price.currency !== reference.currency) return null;
  return ((a - b) / b) * 100;
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) notFound();

  let product: ProductDetail;
  try {
    product = await apiFetch<ProductDetail>(`/products/${productId}`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    return (
      <>
        <PageHeader title="Product" breadcrumbs={[{ label: "Products", href: "/products" }]} />
        <ApiUnavailable message={isApiError(error) ? error.message : "Unexpected error."} />
      </>
    );
  }

  // Matching: a competitor product has a `matching` summary; a reference (Antalis) product
  // lists the competitor products associated with or proposing it (price comparison).
  const [history, config, competitors] = await Promise.all([
    settle(apiFetch<Observation[]>(`/products/${productId}/prices/history`)),
    settle(apiFetch<MatchingConfig>("/matching/config")),
    settle(apiFetch<Competitor[]>("/competitors")),
  ]);
  const competitor = competitors.data?.find((c) => c.id === product.competitor_id);
  const referenceId = competitors.data?.find((c) => c.key === config.data?.reference_competitor)?.id;
  const isReference = referenceId !== undefined && product.competitor_id === referenceId;
  const matchedId = product.matching ? (product.matching.antalis_product_id ?? product.matching.proposed_antalis_product_id) : null;

  const [antalisProduct, associated] = await Promise.all([
    matchedId ? settle(apiFetch<ProductDetail>(`/products/${matchedId}`)) : Promise.resolve(null),
    isReference
      ? settle(apiFetch<Paginated<MatchListItem>>("/matching/matches", { query: { antalis_product_id: product.id, sort: "score", order: "desc", limit: ASSOCIATED_LIMIT } }))
      : Promise.resolve(null),
  ]);
  // Latest prices of the associated competitor products, for the comparison table.
  const associatedPrices = new Map<number, PriceSummary | null>();
  if (associated?.data) {
    const details = await Promise.all(associated.data.items.map((m) => settle(apiFetch<ProductDetail>(`/products/${m.product.id}`))));
    associated.data.items.forEach((m, i) => associatedPrices.set(m.product.id, details[i].data?.latest_price ?? null));
  }

  const currency = product.latest_price?.currency ?? product.latest_prices[0]?.currency ?? "EUR";
  const chartPoints = history.data ? toChartPoints(history.data) : [];
  const images = productImages(product.images);
  const description = product.description || product.long_description;
  const thresholds = scoreThresholds(config.data);
  const gap = priceGap(product.latest_price, antalisProduct?.data?.latest_price);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Products", href: competitor ? `/products?competitor=${competitor.key}` : "/products" },
          ...product.category_path.map((c) => ({ label: c.name, href: `/categories/${c.id}` })),
        ]}
        title={product.title ?? "Untitled product"}
        actions={
          <>
            <a href={product.url} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <ExternalLinkIcon />
              {competitor ? `Open on ${competitor.name}` : "Open on the site"}
            </a>
            {product.matching ? (
              <Link href={`/matching/products/${product.id}`} className={buttonVariants({ size: "lg" })}>
                Review matching
              </Link>
            ) : null}
          </>
        }
      />

      {/* Images first, next to what identifies and prices the product. */}
      <Card className="gap-0 py-0 md:flex-row">
        <div className="border-b p-4 md:w-2/5 md:border-r md:border-b-0 lg:w-1/3">
          <ImageGallery images={images} alt={product.title ?? "Product image"} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            {competitor ? <ToneBadge tone="info">{competitor.name}</ToneBadge> : null}
            {product.brand ? <ToneBadge tone="violet">{product.brand}</ToneBadge> : null}
            <StatusBadge status={product.status} />
            {product.catalog_reference ? <code className="text-xs text-muted-foreground">{product.catalog_reference}</code> : null}
          </div>
          <div className="flex flex-wrap items-baseline gap-3">
            <PriceLine price={product.latest_price} className="text-2xl" />
            <PriceTrendBadge trend={product.price_trend} currency={currency} />
            {product.latest_price ? <span className="text-xs text-muted-foreground">{labelize(product.latest_price.tax_mode)} · seen {formatRelative(product.latest_price.observed_at)}</span> : null}
          </div>
          {description ? <ReadMore text={description} lines={4} /> : <p className="text-sm text-muted-foreground">No description available.</p>}
          <DefinitionList
            columns={4}
            items={[
              { label: "External ID", value: product.external_id ? <code className="text-xs">{product.external_id}</code> : "—" },
              { label: "First seen", value: formatDateTime(product.first_seen_at) },
              { label: "Last seen", value: formatRelative(product.last_seen_at) },
              { label: product.missing_since ? "Missing since" : "Details updated", value: formatDateTime(product.missing_since ?? product.details_updated_at) },
            ]}
          />
        </div>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Price history" description={chartPoints.length > 0 ? `${chartPoints.length} observation${chartPoints.length > 1 ? "s" : ""}, lowest unit price per capture` : undefined}>
            {history.error ? <ApiUnavailable message={history.error} /> : chartPoints.length > 0 ? <PriceChart points={chartPoints} currency={currency} /> : <EmptyState title="No price observations yet" />}
          </Panel>

          {isReference ? (
            <Panel
              title="Matched competitor products"
              description="Competitor products associated with or proposing this Antalis product, with their price gap"
              flush
              actions={<PanelLink href={`/matching/matches?antalis_product_id=${product.id}`}>All</PanelLink>}
            >
              {associated?.error ? (
                <div className="p-4">
                  <ApiUnavailable message={associated.error} />
                </div>
              ) : associated?.data && associated.data.items.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Competitor product</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Latest price</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {associated.data.items.map((m) => {
                      const price = associatedPrices.get(m.product.id);
                      const pairGap = priceGap(price, product.latest_price);
                      return (
                        <LinkRow key={m.id} href={`/matching/products/${m.product.id}`}>
                          <TableCell className="pl-4">
                            <ProductCell product={m.product} href={`/matching/products/${m.product.id}`} />
                            <p className="mt-0.5 pl-13 text-xs text-muted-foreground">{m.competitor_key}</p>
                          </TableCell>
                          <TableCell>
                            <ScoreRing score={m.score} thresholds={thresholds} />
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <MatchStatusBadge status={m.status} manualChoice={m.manual_choice} />
                              {!m.antalis_product ? <p className="text-xs text-muted-foreground">proposed only</p> : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <PriceLine price={price} />
                            {pairGap !== null ? <GapLabel gap={pairGap} /> : null}
                          </TableCell>
                          <RowChevron />
                        </LinkRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState title="No competitor product matched yet" />
              )}
            </Panel>
          ) : null}

          <Panel title="Price tiers" description="Latest captured prices, including quantity-based tiers" flush>
            {product.latest_prices.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Quantity</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Basis</TableHead>
                    <TableHead>Tax</TableHead>
                    <TableHead>Observed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.latest_prices.map((obs) => (
                    <TableRow key={obs.id}>
                      <TableCell className="pl-4">
                        {obs.min_quantity || obs.max_quantity
                          ? `${obs.min_quantity ?? "0"}${obs.max_quantity ? ` – ${obs.max_quantity}${obs.max_inclusive ? "" : " (excl.)"}` : "+"}${obs.quantity_unit ? ` ${obs.quantity_unit}` : ""}`
                          : obs.quantity
                            ? `${obs.quantity}${obs.quantity_unit ? ` ${obs.quantity_unit}` : ""}`
                            : "Any"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium">{formatPrice(obs.price, obs.currency)}</span>
                        {obs.price_unit ? <span className="text-xs text-muted-foreground"> / {obs.price_unit}</span> : null}
                        {obs.is_promotional ? <ToneBadge tone="warning" className="ml-2">Promo</ToneBadge> : null}
                      </TableCell>
                      <TableCell>{labelize(obs.price_basis)}</TableCell>
                      <TableCell>{labelize(obs.tax_mode)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(obs.observed_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="No prices captured" />
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          {product.matching ? (
            <Panel title="Antalis equivalent" actions={<PanelLink href={`/matching/products/${product.id}`}>Review</PanelLink>}>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <ScoreRing score={product.matching.score} thresholds={thresholds} size={52} />
                  <MatchStatusBadge status={product.matching.status} />
                </div>
                {matchedId ? (
                  antalisProduct?.data ? (
                    <>
                      <div className="flex items-start gap-3">
                        <ProductThumb src={firstImage(antalisProduct.data.images)} size="lg" />
                        <div className="min-w-0 space-y-1">
                          <p className="text-xs text-muted-foreground">{product.matching.antalis_product_id ? "Associated" : "Proposed by the engine"}</p>
                          <Link href={`/products/${antalisProduct.data.id}`} className="line-clamp-3 text-sm font-medium hover:text-primary">
                            {antalisProduct.data.title ?? "Untitled product"}
                          </Link>
                          {antalisProduct.data.catalog_reference ? <code className="text-xs text-muted-foreground">{antalisProduct.data.catalog_reference}</code> : null}
                        </div>
                      </div>
                      <dl className="space-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">This product</dt>
                          <dd>
                            <PriceLine price={product.latest_price} />
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Antalis</dt>
                          <dd>
                            <PriceLine price={antalisProduct.data.latest_price} />
                          </dd>
                        </div>
                        {gap !== null ? (
                          <div className="flex justify-between gap-3 border-t pt-1.5">
                            <dt className="text-muted-foreground">Gap</dt>
                            <dd>
                              <GapLabel gap={gap} />
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Antalis product #{matchedId} could not be loaded.</p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">No Antalis product associated or proposed.</p>
                )}
              </div>
            </Panel>
          ) : isReference && product.match_count > 0 ? (
            <Panel title="Matching">
              <p className="text-sm">
                {formatNumber(product.match_count)} competitor product{product.match_count > 1 ? "s are" : " is"} associated with this Antalis product.
              </p>
            </Panel>
          ) : null}

          <Panel title="Attributes">
            <KeyValueList data={product.normalized_attributes} empty="No normalized attribute." />
          </Panel>
        </div>
      </div>
    </>
  );
}

// Competitor price compared with Antalis: cheaper in green, pricier in red.
function GapLabel({ gap }: { gap: number }) {
  return (
    <span className={cn("block text-xs font-semibold tabular-nums", Math.abs(gap) < 1 ? "text-muted-foreground" : gap < 0 ? "text-emerald-700" : "text-rose-700")}>
      {Math.abs(gap) < 1 ? "At par with Antalis" : `${gap > 0 ? "+" : "−"}${Math.abs(gap).toFixed(1)}% vs Antalis`}
    </span>
  );
}
