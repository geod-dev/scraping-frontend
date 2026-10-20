import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiUnavailable, Badge, Card, DefinitionList, EmptyState, PageHeader, StatCard, StatusBadge, Table, Td, Th } from "@/components/ui";
import { apiFetch, isApiError, settle } from "@/lib/api";
import { formatDateTime, formatNumber, formatPrice, labelize } from "@/lib/format";
import type { Category, CategoryDetail, Competitor, Paginated, ProductListItem } from "@/lib/types";

export default async function CategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) notFound();

  let category: CategoryDetail;
  try {
    category = await apiFetch<CategoryDetail>(`/categories/${categoryId}`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    return (
      <>
        <PageHeader title="Category" />
        <ApiUnavailable message={isApiError(error) ? error.message : "Unexpected error."} />
      </>
    );
  }

  const [competitors, children, products] = await Promise.all([
    settle(apiFetch<Competitor[]>("/competitors")),
    settle(apiFetch<Paginated<Category>>("/categories", { query: { parent_id: categoryId, limit: 200 } })),
    settle(
      apiFetch<Paginated<ProductListItem>>("/products", {
        query: { category_id: categoryId, include_subcategories: true, limit: 20 },
      }),
    ),
  ]);
  const competitorKey = competitors.data?.find((c) => c.id === category.competitor_id)?.key;

  return (
    <>
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-slate-500">
        <Link
          href={competitorKey ? `/categories?competitor=${encodeURIComponent(competitorKey)}` : "/categories"}
          className="hover:text-slate-900"
        >
          Categories
        </Link>
        {category.path.map((c) => (
          <span key={c.id} className="flex items-center gap-1">
            <span aria-hidden>/</span>
            <Link href={`/categories/${c.id}`} className="hover:text-slate-900">
              {c.name}
            </Link>
          </span>
        ))}
      </nav>

      <PageHeader
        title={category.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {category.kind ? <Badge tone="violet">{labelize(category.kind)}</Badge> : null}
            <StatusBadge status={category.status} />
            <a href={category.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-500">
              View on competitor site ↗
            </a>
          </span>
        }
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sub-categories" value={formatNumber(category.children_count)} />
        <StatCard label="Direct products" value={formatNumber(category.product_count)} />
        <StatCard label="Products incl. sub-categories" value={formatNumber(category.subtree_product_count)} href={`/products?category_id=${category.id}`} />
        <StatCard label="Last seen" value={formatDateTime(category.last_seen_at)} />
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Sub-categories" padded={false}>
            {children.error ? (
              <div className="p-5">
                <ApiUnavailable message={children.error} />
              </div>
            ) : children.data && children.data.items.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {children.data.items.map((c) => (
                  <li key={c.id}>
                    <Link href={`/categories/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                      <span className="font-medium text-slate-800">{c.name}</span>
                      <StatusBadge status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-5">
                <EmptyState title="No sub-categories" />
              </div>
            )}
          </Card>

          <Card
            title="Products"
            description="Including sub-categories, most recently seen first"
            padded={false}
            actions={
              <Link href={`/products?category_id=${category.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                All products →
              </Link>
            }
          >
            {products.error ? (
              <div className="p-5">
                <ApiUnavailable message={products.error} />
              </div>
            ) : products.data && products.data.items.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th>Status</Th>
                    <Th align="right">Price</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.data.items.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <Td>
                        <Link href={`/products/${p.id}`} className="font-medium text-indigo-600 hover:text-indigo-500">
                          {p.title ?? "Untitled product"}
                        </Link>
                        {p.brand ? <div className="text-xs text-slate-500">{p.brand}</div> : null}
                      </Td>
                      <Td>
                        <StatusBadge status={p.status} />
                      </Td>
                      <Td align="right">{p.latest_price ? formatPrice(p.latest_price.from_price, p.latest_price.currency) : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="p-5">
                <EmptyState title="No products in this category yet" />
              </div>
            )}
          </Card>
        </div>

        <Card title="Details">
          <DefinitionList
            items={[
              { label: "External ID", value: category.external_id ? <code className="text-xs">{category.external_id}</code> : "—" },
              { label: "Slug", value: category.slug ?? "—" },
              { label: "Depth", value: category.depth ?? "—" },
              { label: "First seen", value: formatDateTime(category.first_seen_at) },
              { label: "Missing since", value: category.missing_since ? formatDateTime(category.missing_since) : "—" },
            ]}
          />
          {Object.keys(category.details ?? {}).length > 0 ? (
            <pre className="mt-6 max-h-80 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
              {JSON.stringify(category.details, null, 2)}
            </pre>
          ) : null}
        </Card>
      </div>
    </>
  );
}
