import Link from "next/link";
import { notFound } from "next/navigation";
import { DecisionReasons, MatchStatusBadge, ProductCell, ScoreGauge } from "@/components/matching";
import { PriceChart, type PricePoint } from "@/components/price-chart";
import { ApiUnavailable, Badge, Card, DefinitionList, EmptyState, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui";
import { apiFetch, isApiError, settle } from "@/lib/api";
import { formatDateTime, formatNumber, formatPrice, formatRelative, labelize } from "@/lib/format";
import type { Competitor, MatchListItem, MatchingConfig, Observation, Paginated, PriceSummary, ProductDetail } from "@/lib/types";

const ASSOCIATED_LIMIT = 20;

function PriceLine({ price }: { price: PriceSummary | null | undefined }) {
  if (!price) return <span className="text-slate-400">—</span>;
  return (
    <span className="whitespace-nowrap">
      <span className="font-medium text-slate-900">{formatPrice(price.from_price, price.currency)}</span>
      {price.price_unit ? (
        <span className="text-xs text-slate-500">
          {" "}
          / {price.price_unit_quantity && price.price_unit_quantity !== "1" ? `${price.price_unit_quantity} ` : ""}
          {price.price_unit}
        </span>
      ) : null}
      {price.tiers > 1 ? <span className="text-xs text-slate-500"> · {price.tiers} tiers</span> : null}
    </span>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Product ${id}` };
}

function imageUrl(item: unknown): string | null {
  if (typeof item === "string") return item.startsWith("http") ? item : null;
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    for (const key of ["url", "src", "href"]) {
      const value = record[key];
      if (typeof value === "string" && value.startsWith("http")) return value;
    }
  }
  return null;
}

function attributePairs(normalized: Record<string, unknown> | null): { label: string; value: string }[] {
  if (!normalized) return [];
  return Object.entries(normalized)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => ({
      label: labelize(key),
      value: typeof value === "object" ? JSON.stringify(value) : String(value),
    }));
}

// One point per observation time: the lowest unit price seen at that time.
function toChartPoints(history: Observation[]): PricePoint[] {
  const byTime = new Map<string, { price: number; promotional: boolean }>();
  for (const obs of history) {
    const price = Number(obs.price);
    if (Number.isNaN(price)) continue;
    const current = byTime.get(obs.observed_at);
    if (!current || price < current.price) {
      byTime.set(obs.observed_at, { price, promotional: obs.is_promotional === true });
    }
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([observedAt, v]) => ({ observedAt, price: v.price, promotional: v.promotional }));
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) notFound();

  let product: ProductDetail;
  let history: Observation[] = [];
  try {
    product = await apiFetch<ProductDetail>(`/products/${productId}`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    return (
      <>
        <PageHeader title="Product" />
        <ApiUnavailable message={isApiError(error) ? error.message : "Unexpected error."} />
      </>
    );
  }

  let historyError: string | null = null;
  try {
    history = await apiFetch<Observation[]>(`/products/${productId}/prices/history`);
  } catch (error) {
    historyError = isApiError(error) ? error.message : "Price history is unavailable.";
  }

  // Matching: a competitor product has a `matching` summary; a reference (Antalis) product
  // lists the competitor products associated with or proposing it (price comparison).
  const [config, competitors] = await Promise.all([
    settle(apiFetch<MatchingConfig>("/matching/config")),
    settle(apiFetch<Competitor[]>("/competitors")),
  ]);
  const referenceId = competitors.data?.find((c) => c.key === config.data?.reference_competitor)?.id;
  const isReference = referenceId !== undefined && product.competitor_id === referenceId;
  const matchedId = product.matching ? (product.matching.antalis_product_id ?? product.matching.proposed_antalis_product_id) : null;

  const [antalisProduct, associated] = await Promise.all([
    matchedId ? settle(apiFetch<ProductDetail>(`/products/${matchedId}`)) : Promise.resolve(null),
    isReference
      ? settle(
          apiFetch<Paginated<MatchListItem>>("/matching/matches", {
            query: { antalis_product_id: product.id, sort: "score", order: "desc", limit: ASSOCIATED_LIMIT },
          }),
        )
      : Promise.resolve(null),
  ]);
  // Latest prices of the associated competitor products, for the comparison table.
  const associatedPrices = new Map<number, PriceSummary | null>();
  if (associated?.data) {
    const details = await Promise.all(associated.data.items.map((m) => settle(apiFetch<ProductDetail>(`/products/${m.product.id}`))));
    associated.data.items.forEach((m, i) => associatedPrices.set(m.product.id, details[i].data?.latest_price ?? null));
  }

  const currency = product.latest_price?.currency ?? product.latest_prices[0]?.currency ?? "EUR";
  const chartPoints = toChartPoints(history);
  const images = (product.images ?? []).map(imageUrl).filter((u): u is string => Boolean(u));
  const attributes = attributePairs(product.normalized_attributes);

  return (
    <>
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/products" className="hover:text-slate-900">
          Products
        </Link>
        {product.category_path.map((c) => (
          <span key={c.id}>
            {" / "}
            <Link href={`/categories/${c.id}`} className="hover:text-slate-900">
              {c.name}
            </Link>
          </span>
        ))}
      </nav>

      <PageHeader
        title={product.title ?? "Untitled product"}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {product.brand ? <Badge tone="violet">{product.brand}</Badge> : null}
            <StatusBadge status={product.status} />
            <a href={product.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-500">
              View on competitor site ↗
            </a>
          </span>
        }
        actions={
          product.matching ? (
            <Link href={`/matching/products/${product.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Review matching →
            </Link>
          ) : isReference && product.match_count > 0 ? (
            <Link href={`/matching/matches?antalis_product_id=${product.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              {formatNumber(product.match_count)} associated competitor product{product.match_count > 1 ? "s" : ""} →
            </Link>
          ) : null
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {product.matching ? (
            <Card
              title="Matching"
              description="Equivalent product in the Antalis reference catalog"
              actions={
                <Link href={`/matching/products/${product.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                  Open review screen →
                </Link>
              }
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <MatchStatusBadge status={product.matching.status} />
                  <ScoreGauge score={product.matching.score} />
                </div>
                {matchedId ? (
                  antalisProduct?.data ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {product.matching.antalis_product_id ? "Associated Antalis product" : "Proposed Antalis product"}
                        </p>
                        <div className="mt-1">
                          <ProductCell
                            product={{
                              ...antalisProduct.data,
                              competitor_key: config.data?.reference_competitor ?? "",
                              category: antalisProduct.data.category_path.at(-1)?.name ?? null,
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Prices</p>
                        <dl className="mt-1 space-y-1 text-sm">
                          <div className="flex justify-between gap-3">
                            <dt className="text-slate-500">This product</dt>
                            <dd>
                              <PriceLine price={product.latest_price} />
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-slate-500">Antalis</dt>
                            <dd>
                              <PriceLine price={antalisProduct.data.latest_price} />
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Antalis product #{matchedId} could not be loaded.</p>
                  )
                ) : (
                  <p className="text-sm text-slate-500">No Antalis product associated or proposed.</p>
                )}
              </div>
            </Card>
          ) : null}

          {isReference ? (
            <Card
              title="Matched competitor products"
              description="Competitor products associated with or proposing this Antalis product: compare their prices"
              padded={false}
              actions={
                <Link href={`/matching/matches?antalis_product_id=${product.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                  All →
                </Link>
              }
            >
              {associated?.error ? (
                <div className="p-5">
                  <ApiUnavailable message={associated.error} />
                </div>
              ) : associated?.data && associated.data.items.length > 0 ? (
                <Table>
                  <thead>
                    <tr>
                      <Th>Competitor product</Th>
                      <Th>Status</Th>
                      <Th>Score</Th>
                      <Th align="right">Latest price</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-indigo-50/40">
                      <Td>
                        <span className="font-medium text-slate-900">This Antalis product</span>
                      </Td>
                      <Td />
                      <Td />
                      <Td align="right">
                        <PriceLine price={product.latest_price} />
                      </Td>
                    </tr>
                    {associated.data.items.map((m) => (
                      <tr key={m.id} className="align-top hover:bg-slate-50">
                        <Td>
                          <ProductCell product={m.product} />
                          <p className="mt-0.5 text-xs text-slate-400">{m.competitor_key}</p>
                        </Td>
                        <Td>
                          <div className="space-y-1">
                            <MatchStatusBadge status={m.status} manualChoice={m.manual_choice} />
                            {!m.antalis_product ? <p className="text-xs text-slate-400">proposed only</p> : null}
                            <DecisionReasons reasons={m.decision_reasons} compact />
                          </div>
                        </Td>
                        <Td>
                          <Link href={`/matching/products/${m.product.id}`}>
                            <ScoreGauge score={m.score} />
                          </Link>
                        </Td>
                        <Td align="right">
                          <PriceLine price={associatedPrices.get(m.product.id)} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <div className="p-5">
                  <EmptyState title="No competitor product matched yet" />
                </div>
              )}
            </Card>
          ) : null}

          <Card title="Price history" description={chartPoints.length > 0 ? `${chartPoints.length} observation${chartPoints.length > 1 ? "s" : ""}` : undefined}>
            {historyError ? (
              <ApiUnavailable message={historyError} />
            ) : chartPoints.length > 0 ? (
              <PriceChart points={chartPoints} currency={currency} />
            ) : (
              <EmptyState title="No price observations yet" />
            )}
          </Card>

          <Card title="Price tiers" description="Latest captured prices, including quantity-based tiers" padded={false}>
            {product.latest_prices.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    <Th>Quantity</Th>
                    <Th align="right">Price</Th>
                    <Th>Basis</Th>
                    <Th>Tax</Th>
                    <Th>Observed</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {product.latest_prices.map((obs) => (
                    <tr key={obs.id}>
                      <Td>
                        {obs.min_quantity || obs.max_quantity ? (
                          <span>
                            {obs.min_quantity ?? "0"}
                            {obs.max_quantity ? ` – ${obs.max_quantity}${obs.max_inclusive ? "" : " (excl.)"}` : "+"}
                            {obs.quantity_unit ? ` ${obs.quantity_unit}` : ""}
                          </span>
                        ) : obs.quantity ? (
                          `${obs.quantity}${obs.quantity_unit ? ` ${obs.quantity_unit}` : ""}`
                        ) : (
                          "Any"
                        )}
                      </Td>
                      <Td align="right">
                        <span className="font-medium text-slate-900">{formatPrice(obs.price, obs.currency)}</span>
                        {obs.price_unit ? <span className="text-xs text-slate-500"> / {obs.price_unit}</span> : null}
                      </Td>
                      <Td>{labelize(obs.price_basis)}</Td>
                      <Td>{labelize(obs.tax_mode)}</Td>
                      <Td>
                        <span className="whitespace-nowrap">{formatDateTime(obs.observed_at)}</span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="p-5">
                <EmptyState title="No prices captured" />
              </div>
            )}
          </Card>

          <Card title="Description">
            {product.description || product.long_description ? (
              <div className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {product.description ?? product.long_description}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No description available.</p>
            )}
          </Card>

          {attributes.length > 0 ? (
            <Card title="Attributes">
              <DefinitionList items={attributes} />
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {images.length > 0 ? (
            <Card title="Images" padded={false}>
              <div className="grid grid-cols-2 gap-2 p-3">
                {images.slice(0, 4).map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element -- remote catalog images, not optimized
                  <img key={src} src={src} alt="" className="aspect-square w-full rounded-md border border-slate-200 bg-white object-contain" loading="lazy" />
                ))}
              </div>
            </Card>
          ) : null}

          <Card title="Details">
            <DefinitionList
              items={[
                { label: "Latest price", value: product.latest_price ? formatPrice(product.latest_price.from_price, product.latest_price.currency) : "—" },
                { label: "Reference", value: product.catalog_reference ? <code className="text-xs">{product.catalog_reference}</code> : "—" },
                { label: "External ID", value: product.external_id ? <code className="text-xs">{product.external_id}</code> : "—" },
                { label: "First seen", value: formatDateTime(product.first_seen_at) },
                { label: "Last seen", value: formatRelative(product.last_seen_at) },
                { label: "Last price", value: formatRelative(product.last_price_observed_at) },
                { label: "Missing since", value: product.missing_since ? formatDateTime(product.missing_since) : "—" },
                { label: "Details updated", value: formatDateTime(product.details_updated_at) },
              ]}
            />
          </Card>

          <Card title="Category path">
            {product.category_path.length > 0 ? (
              <ol className="space-y-1.5 text-sm">
                {product.category_path.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-2" style={{ paddingLeft: `${i * 0.75}rem` }}>
                    <span className="text-slate-400">↳</span>
                    <Link href={`/categories/${c.id}`} className="text-indigo-600 hover:text-indigo-500">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-slate-500">Not linked to a category.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
