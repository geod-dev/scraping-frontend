import Link from "next/link";
import { LayoutGridIcon, ListIcon } from "lucide-react";
import { FilterBar, FilterField, FilterGroup, FilterOrder, FilterSearch, FilterSelect, FilterSheet, FilterToggle } from "@/components/filters";
import { ApiUnavailable, EmptyState, FilterChips, PageHeader, Pagination, RowChevron, StatusBadge } from "@/components/kit";
import { LinkRow } from "@/components/link-row";
import { PriceLine, PriceTrendBadge } from "@/components/price";
import { ProductCard } from "@/components/product-card";
import { ProductThumb } from "@/components/product-thumb";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch, settle } from "@/lib/api";
import { clearFiltersHref, filterChips } from "@/lib/filter-chips";
import { formatNumber, formatRelative } from "@/lib/format";
import { firstImage } from "@/lib/images";
import { boolFlag, oneOf, positiveInt, text, type SearchParams } from "@/lib/params";
import type { Competitor, Paginated, ProductFacets, ProductListItem } from "@/lib/types";

export const metadata = { title: "Products" };

// Divisible by 2, 3, 4 and 6: full rows in every grid width.
const PAGE_SIZE = 24;
const SORTS = ["last_seen_at", "title", "reference", "brand", "created_at", "updated_at", "last_price_observed_at", "id"] as const;
const SORT_LABELS: Record<(typeof SORTS)[number], string> = {
  last_seen_at: "Last seen",
  title: "Title",
  reference: "Reference",
  brand: "Brand",
  created_at: "Created",
  updated_at: "Updated",
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
  const view = oneOf(sp.view, ["table"] as const) ?? "grid";

  const [competitors, products, facets] = await Promise.all([
    settle(apiFetch<Competitor[]>("/competitors")),
    settle(
      apiFetch<Paginated<ProductListItem>>("/products", {
        query: { competitor, q, status, brand, has_price: hasPrice, sort, order, category_id: categoryId, include_subcategories: categoryId ? true : undefined, limit: PAGE_SIZE, offset },
      }),
    ),
    settle(apiFetch<ProductFacets>("/products/facets", { query: { competitor, q, status, category_id: categoryId, include_subcategories: categoryId ? true : undefined } })),
  ]);

  const names = new Map(competitors.data?.map((c) => [c.key, c.name]));
  const namesById = new Map(competitors.data?.map((c) => [c.id, c.name]));
  const values = {
    q,
    competitor,
    status,
    brand,
    category_id: categoryId ? String(categoryId) : undefined,
    has_price: hasPrice === undefined ? undefined : hasPrice ? "1" : "0",
    sort: sort === "last_seen_at" ? undefined : sort,
    order: order === "desc" ? undefined : order,
    view: view === "grid" ? undefined : view,
  };
  const chips = filterChips("/products", values, [
    { name: "q", label: "Search" },
    { name: "competitor", label: "Competitor", format: (v) => names.get(v) ?? v },
    { name: "status", label: "Status", format: (v) => (v === "active" ? "Active" : "Missing") },
    { name: "has_price", label: "Price", format: (v) => (v === "1" ? "With price" : "Without price") },
    { name: "brand", label: "Brand" },
    { name: "category_id", label: "Category", format: (v) => `#${v} and sub-categories` },
  ]);
  const clearHref = clearFiltersHref("/products", values, ["sort", "order", "view"]);
  const sheetCount = chips.filter((c) => !["q", "competitor"].includes(c.key)).length;

  return (
    <>
      <PageHeader
        title="Products"
        description={products.data ? `${formatNumber(products.data.total)} products match these filters` : "Browse and search the catalogs"}
        toolbar={
          <FilterBar
            trailing={
              <>
                <FilterSelect name="sort" label="Sort by" defaultValue="last_seen_at" options={SORTS.map((s) => ({ value: s, label: SORT_LABELS[s] }))} />
                <FilterOrder />
                <FilterToggle
                  name="view"
                  label="View"
                  anyLabel={
                    <>
                      <LayoutGridIcon />
                      <span className="sr-only">Grid</span>
                    </>
                  }
                  options={[
                    {
                      value: "table",
                      label: (
                        <>
                          <ListIcon />
                          <span className="sr-only">Table</span>
                        </>
                      ),
                    },
                  ]}
                />
              </>
            }
          >
            <FilterSearch name="q" label="Search products" placeholder="Title, reference, brand…" />
            <FilterSelect name="competitor" label="Competitor" allLabel="All competitors" options={(competitors.data ?? []).map((c) => ({ value: c.key, label: c.name }))} />
            <FilterSheet count={sheetCount} clearHref={clearHref}>
              <FilterGroup title="Catalog">
                <FilterField label="Status">
                  <FilterToggle name="status" label="Status" options={[{ value: "active", label: "Active" }, { value: "missing", label: "Missing" }]} />
                </FilterField>
                <FilterField label="Price">
                  <FilterToggle name="has_price" label="Price" options={[{ value: "1", label: "With price" }, { value: "0", label: "Without price" }]} />
                </FilterField>
              </FilterGroup>
              <FilterGroup title="Brand">
                <FilterField label="Brand" hint={facets.data ? `${facets.data.brands.length} brands for these filters` : undefined}>
                  <FilterSelect name="brand" label="Brand" allLabel="All brands" className="w-full" options={(facets.data?.brands ?? []).map((b) => ({ value: b.value, label: b.value, count: b.count }))} />
                </FilterField>
              </FilterGroup>
            </FilterSheet>
            <FilterChips chips={chips} clearHref={clearHref} />
          </FilterBar>
        }
      />

      {products.error ? <ApiUnavailable message={products.error} /> : null}

      {products.data ? (
        products.data.items.length === 0 ? (
          <EmptyState title="No products found">Products appear once a catalog sync has run. Try removing filters if you expected results.</EmptyState>
        ) : (
          <>
            {view === "grid" ? (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
                {products.data.items.map((p) => (
                  <li key={p.id}>
                    <ProductCard product={p} competitor={namesById.get(p.competitor_id)} />
                  </li>
                ))}
              </ul>
            ) : (
              <Card className="py-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Product</TableHead>
                      <TableHead>Competitor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Last seen</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.data.items.map((p) => (
                      <LinkRow key={p.id} href={`/products/${p.id}`}>
                        <TableCell className="pl-4">
                          <div className="flex min-w-0 max-w-lg items-center gap-3">
                            <ProductThumb src={firstImage(p.images)} />
                            <div className="min-w-0">
                              <Link href={`/products/${p.id}`} className="line-clamp-2 font-medium whitespace-normal hover:text-primary">
                                {p.title ?? "Untitled product"}
                              </Link>
                              <p className="text-xs text-muted-foreground">
                                {[p.brand, p.catalog_reference ?? p.external_id].filter(Boolean).join(" · ") || "—"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{namesById.get(p.competitor_id) ?? "—"}</TableCell>
                        <TableCell>
                          <StatusBadge status={p.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <PriceLine price={p.latest_price} />
                            <PriceTrendBadge trend={p.price_trend} currency={p.latest_price?.currency} />
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatRelative(p.last_seen_at)}</TableCell>
                        <RowChevron />
                      </LinkRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
            <Pagination basePath="/products" query={values} total={products.data.total} limit={products.data.limit} offset={products.data.offset} />
          </>
        )
      ) : null}
    </>
  );
}
