import Link from "next/link";
import { ApiUnavailable, Badge, Card, EmptyState, FilterBar, Field, Pagination, PageHeader, StatusBadge, Table, Td, Th, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { apiFetch, settle } from "@/lib/api";
import { formatNumber, formatPrice, formatRelative } from "@/lib/format";
import { boolFlag, buildQuery, oneOf, positiveInt, text, type SearchParams } from "@/lib/params";
import type { Competitor, Paginated, ProductFacets, ProductListItem } from "@/lib/types";

export const metadata = { title: "Products" };

const PAGE_SIZE = 25;
const SORTS = ["title", "reference", "brand", "created_at", "updated_at", "last_seen_at", "last_price_observed_at", "id"] as const;
const SORT_LABELS: Record<(typeof SORTS)[number], string> = {
  title: "Title",
  reference: "Reference",
  brand: "Brand",
  created_at: "Created",
  updated_at: "Updated",
  last_seen_at: "Last seen",
  last_price_observed_at: "Last price",
  id: "ID",
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = text(sp.q);
  const competitor = text(sp.competitor, 64);
  const status = oneOf(sp.status, ["active", "missing"] as const);
  const brand = text(sp.brand);
  const hasPrice = boolFlag(sp.has_price);
  const sort = oneOf(sp.sort, SORTS) ?? "last_seen_at";
  const order = oneOf(sp.order, ["asc", "desc"] as const) ?? "desc";
  const offset = positiveInt(sp.offset, 0);
  const categoryId = positiveInt(sp.category_id, 0) || undefined;

  const filters = { competitor, q, status, brand, has_price: hasPrice, sort, order };

  const [competitors, products, facets] = await Promise.all([
    settle(apiFetch<Competitor[]>("/competitors")),
    settle(
      apiFetch<Paginated<ProductListItem>>("/products", {
        query: { ...filters, category_id: categoryId, include_subcategories: categoryId ? true : undefined, limit: PAGE_SIZE, offset },
      }),
    ),
    settle(apiFetch<ProductFacets>("/products/facets", { query: { competitor, q, status, category_id: categoryId, include_subcategories: categoryId ? true : undefined } })),
  ]);

  const queryForPaging: Record<string, string | undefined> = {
    competitor,
    q,
    status,
    brand,
    category_id: categoryId ? String(categoryId) : undefined,
    has_price: hasPrice === undefined ? undefined : hasPrice ? "1" : "0",
    sort,
    order,
  };

  return (
    <>
      <PageHeader
        title="Products"
        description={products.data ? `${formatNumber(products.data.total)} products match these filters` : "Browse and search the catalog"}
      />

      <FilterBar>
        <Field label="Search">
          <input className={`${inputClass} w-64`} name="q" defaultValue={q} placeholder="Title, reference, brand…" />
        </Field>
        <Field label="Competitor">
          <select className={inputClass} name="competitor" defaultValue={competitor ?? ""}>
            <option value="">All competitors</option>
            {competitors.data?.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className={inputClass} name="status" defaultValue={status ?? ""}>
            <option value="">Any</option>
            <option value="active">Active</option>
            <option value="missing">Missing</option>
          </select>
        </Field>
        <Field label="Price">
          <select className={inputClass} name="has_price" defaultValue={hasPrice === undefined ? "" : hasPrice ? "1" : "0"}>
            <option value="">Any</option>
            <option value="1">With price</option>
            <option value="0">Without price</option>
          </select>
        </Field>
        <Field label="Sort by">
          <select className={inputClass} name="sort" defaultValue={sort}>
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Order">
          <select className={inputClass} name="order" defaultValue={order}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </Field>
        {brand ? <input type="hidden" name="brand" value={brand} /> : null}
        {categoryId ? <input type="hidden" name="category_id" value={categoryId} /> : null}
        <div className="flex gap-2">
          <button type="submit" className={primaryButton}>
            Apply
          </button>
          <Link href="/products" className={secondaryButton}>
            Reset
          </Link>
        </div>
      </FilterBar>

      {categoryId ? (
        <div className="-mt-2 mb-5 flex items-center gap-2 text-sm text-slate-600">
          <Badge tone="info">Category #{categoryId} · incl. sub-categories</Badge>
          <Link href={`/products?${buildQuery({ ...queryForPaging, category_id: undefined })}`} className="text-xs font-medium text-indigo-600">
            Clear
          </Link>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <div className="min-w-0">
          {products.error ? <ApiUnavailable message={products.error} /> : null}

          {products.data ? (
            products.data.items.length === 0 ? (
              <EmptyState title="No products found">
                Products appear here once a catalog sync has run. Try clearing filters if you expected results.
              </EmptyState>
            ) : (
              <>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Product</Th>
                        <Th>Reference</Th>
                        <Th>Brand</Th>
                        <Th>Status</Th>
                        <Th align="right">Price</Th>
                        <Th>Last seen</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {products.data.items.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <Td>
                            <Link href={`/products/${p.id}`} className="line-clamp-2 max-w-md font-medium text-indigo-600 hover:text-indigo-500">
                              {p.title ?? "Untitled product"}
                            </Link>
                          </Td>
                          <Td>
                            <code className="text-xs text-slate-600">{p.catalog_reference ?? p.external_id ?? "—"}</code>
                          </Td>
                          <Td>{p.brand ?? "—"}</Td>
                          <Td>
                            <StatusBadge status={p.status} />
                          </Td>
                          <Td align="right">
                            {p.latest_price ? (
                              <div>
                                <div className="font-medium text-slate-900">{formatPrice(p.latest_price.from_price, p.latest_price.currency)}</div>
                                {p.latest_price.tiers > 1 ? <div className="text-xs text-slate-500">{p.latest_price.tiers} tiers</div> : null}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </Td>
                          <Td>
                            <span className="whitespace-nowrap text-slate-600">{formatRelative(p.last_seen_at)}</span>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
                <Pagination basePath="/products" query={queryForPaging} total={products.data.total} limit={products.data.limit} offset={products.data.offset} />
              </>
            )
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card title="Brands" description={facets.data ? `${facets.data.brands.length} shown` : undefined} padded={false}>
            {facets.error ? (
              <div className="p-4 text-xs text-rose-700">{facets.error}</div>
            ) : facets.data && facets.data.brands.length > 0 ? (
              <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                {facets.data.brands.slice(0, 40).map((b) => {
                  const active = brand === b.value;
                  return (
                    <li key={b.value}>
                      <Link
                        href={`/products?${buildQuery({ ...queryForPaging, brand: b.value })}`}
                        className={`flex items-center justify-between px-4 py-2 text-sm ${active ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-700 hover:bg-slate-50"}`}
                      >
                        <span className="truncate">{b.value}</span>
                        <span className="ml-2 tabular-nums text-xs text-slate-500">{formatNumber(b.count)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="p-4 text-xs text-slate-500">No brand facets for these filters.</p>
            )}
            {brand ? (
              <div className="border-t border-slate-100 p-3">
                <Link href={`/products?${buildQuery({ ...queryForPaging, brand: undefined })}`} className="text-xs font-medium text-indigo-600">
                  Clear brand filter ({brand})
                </Link>
              </div>
            ) : null}
          </Card>
        </aside>
      </div>
    </>
  );
}
