import Link from "next/link";
import { DataTabs } from "@/components/data";
import { ApiUnavailable, Badge, Card, EmptyState, Field, FilterBar, PageHeader, Pagination, Table, Td, Th, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { apiFetch, settle } from "@/lib/api";
import { formatNumber, labelize } from "@/lib/format";
import { boolFlag, positiveInt, text, type SearchParams } from "@/lib/params";
import type { Competitor, DimensionlessPage } from "@/lib/types";

export const metadata = { title: "Dimensionless products" };

const PAGE_SIZE = 50;

export default async function DimensionlessPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const productType = text(sp.product_type, 64);
  const titleHasNumbers = boolFlag(sp.title_has_numbers);
  const offset = positiveInt(sp.offset, 0);

  const competitors = await settle(apiFetch<Competitor[]>("/competitors"));
  // The endpoint needs a competitor: default to the first one.
  const competitor = text(sp.competitor, 64) ?? competitors.data?.[0]?.key;

  const products = competitor
    ? await settle(
        apiFetch<DimensionlessPage>("/matching/dimensionless", {
          query: { competitor, product_type: productType, title_has_numbers: titleHasNumbers, limit: PAGE_SIZE, offset },
        }),
      )
    : null;

  const paging = {
    competitor,
    product_type: productType,
    title_has_numbers: titleHasNumbers === undefined ? undefined : titleHasNumbers ? "1" : "0",
  };
  const types = Object.entries(products?.data?.by_product_type ?? {}).sort((a, b) => b[1] - a[1]);
  const allCount = types.reduce((sum, [, count]) => sum + count, 0);

  return (
    <>
      <PageHeader
        title="Other data"
        description={
          products?.data
            ? `${formatNumber(allCount)} products whose dimensions could not be read, so their matching cannot compare measures.`
            : "Products whose dimensions could not be read from their attributes or title"
        }
      />
      <DataTabs active="/data/dimensionless" />

      <FilterBar>
        <Field label="Competitor">
          <select className={inputClass} name="competitor" defaultValue={competitor ?? ""}>
            {competitors.data?.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Product type">
          <select className={inputClass} name="product_type" defaultValue={productType ?? ""}>
            <option value="">Any</option>
            {types.map(([type, count]) => (
              <option key={type} value={type}>
                {labelize(type)} ({formatNumber(count)})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title">
          <select className={inputClass} name="title_has_numbers" defaultValue={paging.title_has_numbers ?? ""}>
            <option value="">Any</option>
            <option value="1">With numbers (likely parsing gap)</option>
            <option value="0">Without numbers</option>
          </select>
        </Field>
        <div className="flex gap-2">
          <button type="submit" className={primaryButton}>
            Apply
          </button>
          <Link href="/data/dimensionless" className={secondaryButton}>
            Reset
          </Link>
        </div>
      </FilterBar>

      {competitors.error ? <ApiUnavailable message={competitors.error} /> : null}
      {products?.error ? <ApiUnavailable message={products.error} /> : null}

      {products?.data ? (
        products.data.items.length === 0 ? (
          <EmptyState title="No product without dimensions">Every readable product of this competitor has at least one measure.</EmptyState>
        ) : (
          <>
            <p className="mb-2 text-sm text-slate-500">{formatNumber(products.data.total)} products with these filters</p>
            <Card padded={false}>
              <Table>
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th>Category</Th>
                    <Th>Type</Th>
                    <Th>Normalized attributes</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.data.items.map((p) => (
                    <tr key={p.product_id} className="hover:bg-slate-50">
                      <Td>
                        <Link href={`/products/${p.product_id}`} className="font-medium text-indigo-600 hover:text-indigo-500">
                          {p.title ?? `#${p.product_id}`}
                        </Link>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          {p.catalog_reference ? <span>{p.catalog_reference}</span> : null}
                          {p.title_has_numbers ? <Badge tone="warning">Numbers in title</Badge> : null}
                        </div>
                      </Td>
                      <Td>{p.category ?? "—"}</Td>
                      <Td>{p.product_type ? labelize(p.product_type) : <span className="text-slate-400">Unknown</span>}</Td>
                      <Td>
                        <Attributes values={p.normalized_attributes} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
            <Pagination basePath="/data/dimensionless" query={paging} total={products.data.total} limit={products.data.limit} offset={products.data.offset} />
          </>
        )
      ) : null}
    </>
  );
}

function Attributes({ values }: { values: Record<string, unknown> }) {
  const entries = Object.entries(values);
  if (entries.length === 0) return <span className="text-slate-400">None</span>;
  return (
    <ul className="flex max-w-md flex-wrap gap-1">
      {entries.map(([key, value]) => (
        <li key={key}>
          <Badge tone="neutral">
            {labelize(key)}: {typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
