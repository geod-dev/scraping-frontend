import Link from "next/link";
import { FilterBar, FilterSelect, FilterToggle } from "@/components/filters";
import { ApiUnavailable, EmptyState, FilterChips, PageHeader, Pagination, RowChevron, ToneBadge } from "@/components/kit";
import { LinkRow } from "@/components/link-row";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch, settle } from "@/lib/api";
import { clearFiltersHref, filterChips } from "@/lib/filter-chips";
import { formatNumber, labelize } from "@/lib/format";
import { formatValue } from "@/lib/matching";
import { boolFlag, positiveInt, text, type SearchParams } from "@/lib/params";
import type { Competitor, DimensionlessPage } from "@/lib/types";

export const metadata = { title: "Products without dimensions" };

const PAGE_SIZE = 50;

export default async function DimensionlessProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const productType = text(sp.product_type, 64);
  const titleHasNumbers = boolFlag(sp.title_has_numbers);
  const offset = positiveInt(sp.offset, 0);

  const competitors = await settle(apiFetch<Competitor[]>("/competitors"));
  // The endpoint needs a competitor: default to the first one.
  const first = competitors.data?.[0]?.key;
  const competitor = text(sp.competitor, 64) ?? first;

  const products = competitor
    ? await settle(
        apiFetch<DimensionlessPage>("/matching/dimensionless", {
          query: { competitor, product_type: productType, title_has_numbers: titleHasNumbers, limit: PAGE_SIZE, offset },
        }),
      )
    : null;

  const types = Object.entries(products?.data?.by_product_type ?? {}).sort((a, b) => b[1] - a[1]);
  const allCount = types.reduce((sum, [, count]) => sum + count, 0);
  const values = {
    competitor: competitor === first ? undefined : competitor,
    product_type: productType,
    title_has_numbers: titleHasNumbers === undefined ? undefined : titleHasNumbers ? "1" : "0",
  };
  const chips = filterChips("/data/dimensionless", values, [
    { name: "product_type", label: "Type", format: labelize },
    { name: "title_has_numbers", label: "Title", format: (v) => (v === "1" ? "With numbers" : "Without numbers") },
  ]);
  const clearHref = clearFiltersHref("/data/dimensionless", values, ["competitor"]);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Other data" }]}
        title="Products without dimensions"
        description={
          products?.data
            ? `${formatNumber(allCount)} products whose dimensions could not be read: their matching cannot compare measures.`
            : "Products whose dimensions could not be read from their attributes or title"
        }
        toolbar={
          <FilterBar>
            <FilterSelect name="competitor" label="Competitor" defaultValue={first} options={(competitors.data ?? []).map((c) => ({ value: c.key, label: c.name }))} />
            <FilterSelect name="product_type" label="Product type" allLabel={`All types (${formatNumber(allCount)})`} options={types.map(([type, count]) => ({ value: type, label: labelize(type), count }))} />
            <FilterToggle
              name="title_has_numbers"
              label="Numbers in the title"
              options={[
                { value: "1", label: "Numbers in title" },
                { value: "0", label: "No numbers" },
              ]}
            />
            <FilterChips chips={chips} clearHref={clearHref} />
          </FilterBar>
        }
      />

      {competitors.error ? <ApiUnavailable message={competitors.error} /> : null}
      {products?.error ? <ApiUnavailable message={products.error} /> : null}

      {products?.data ? (
        products.data.items.length === 0 ? (
          <EmptyState title="No product without dimensions">Every readable product of this competitor has at least one measure.</EmptyState>
        ) : (
          <>
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Normalized attributes</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.data.items.map((p) => (
                    <LinkRow key={p.product_id} href={`/products/${p.product_id}`} className="align-top">
                      <TableCell className="max-w-md pl-4 whitespace-normal">
                        <Link href={`/products/${p.product_id}`} className="font-medium hover:text-primary">
                          {p.title ?? `#${p.product_id}`}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {p.catalog_reference ? <code>{p.catalog_reference}</code> : null}
                          {p.title_has_numbers ? <ToneBadge tone="warning">Numbers in title</ToneBadge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">{p.category ?? "—"}</TableCell>
                      <TableCell>{p.product_type ? labelize(p.product_type) : <span className="text-muted-foreground">Unknown</span>}</TableCell>
                      <TableCell className="whitespace-normal">
                        <Attributes values={p.normalized_attributes} />
                      </TableCell>
                      <RowChevron />
                    </LinkRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            <Pagination basePath="/data/dimensionless" query={{ ...values, competitor }} total={products.data.total} limit={products.data.limit} offset={products.data.offset} />
          </>
        )
      ) : null}
    </>
  );
}

function Attributes({ values }: { values: Record<string, unknown> }) {
  const entries = Object.entries(values);
  if (entries.length === 0) return <span className="text-muted-foreground">None</span>;
  return (
    <ul className="flex max-w-md flex-wrap gap-1">
      {entries.map(([key, value]) => (
        <li key={key}>
          <ToneBadge className="h-auto max-w-64 whitespace-normal">
            {labelize(key)}: {formatValue(value)}
          </ToneBadge>
        </li>
      ))}
    </ul>
  );
}
