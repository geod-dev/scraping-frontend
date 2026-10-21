import Link from "next/link";
import { notFound } from "next/navigation";
import { DatabaseZapIcon, ExternalLinkIcon, GitCompareArrowsIcon, TagIcon } from "lucide-react";
import { BanCategoryButton, type CategoryTarget } from "@/components/category-actions";
import { ApiUnavailable, DefinitionList, EmptyState, ExtraCategoryBadge, KeyValueList, PageHeader, Panel, PanelLink, StatCard, StatusBadge, ToneBadge } from "@/components/kit";
import { LiveRefresh } from "@/components/live";
import { ProductCard } from "@/components/product-card";
import { StartTaskButton } from "@/components/task-dialog";
import { apiFetch, isApiError, settle } from "@/lib/api";
import { formatDateTime, formatNumber, labelize } from "@/lib/format";
import type { Category, CategoryDetail, Competitor, Paginated, ProductListItem } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Category ${id}` };
}

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
        <PageHeader title="Category" breadcrumbs={[{ label: "Categories", href: "/categories" }]} />
        <ApiUnavailable message={isApiError(error) ? error.message : "Unexpected error."} />
      </>
    );
  }

  const [competitors, children, products] = await Promise.all([
    settle(apiFetch<Competitor[]>("/competitors")),
    settle(apiFetch<Paginated<Category>>("/categories", { query: { parent_id: categoryId, limit: 200 } })),
    settle(apiFetch<Paginated<ProductListItem>>("/products", { query: { category_id: categoryId, include_subcategories: true, limit: 12 } })),
  ]);
  const competitor = competitors.data?.find((c) => c.id === category.competitor_id);
  const parent = category.path.length > 1 ? category.path[category.path.length - 2] : null;
  const treeHref = competitor ? `/categories?competitor=${encodeURIComponent(competitor.key)}` : "/categories";
  const target: CategoryTarget | null = competitor
    ? {
        id: category.id,
        name: category.name,
        competitorKey: competitor.key,
        competitorName: competitor.name,
        isReference: competitor.worker.tasks?.matching?.reason === "matching_reference",
      }
    : null;
  const busyReason = competitor && competitor.worker.state !== "idle" ? "The worker of this competitor is busy with another job" : null;
  // An extra category owns no product: it lists products filed in other categories.
  const extra = category.role === "extra";
  const jobProps = target ? { competitorKey: target.competitorKey, competitorName: target.competitorName, category: { id: category.id, name: category.name } } : null;

  return (
    <>
      {competitor ? <LiveRefresh on={["job.status", "competitor.updated"]} competitor={competitor.key} /> : null}
      <PageHeader
        breadcrumbs={[
          { label: competitor ? `Categories · ${competitor.name}` : "Categories", href: treeHref },
          ...category.path.filter((c) => c.id !== category.id).map((c) => ({ label: c.name, href: `/categories/${c.id}` })),
        ]}
        title={category.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {extra ? <ExtraCategoryBadge /> : null}
            {category.kind ? <ToneBadge tone="violet">{labelize(category.kind)}</ToneBadge> : null}
            <StatusBadge status={category.status} />
            <a href={category.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:text-primary/80">
              Open on the site
              <ExternalLinkIcon className="size-3.5" />
            </a>
          </span>
        }
        actions={
          target && jobProps ? (
            <>
              <StartTaskButton {...jobProps} task="catalog_sync" label="Scrape this category…" icon={<DatabaseZapIcon />} disabled={Boolean(busyReason)} disabledReason={busyReason} />
              <StartTaskButton {...jobProps} task="price_refresh" label="Refresh prices…" icon={<TagIcon />} variant="outline" disabled={Boolean(busyReason)} disabledReason={busyReason} />
              {target.isReference ? null : (
                <StartTaskButton {...jobProps} task="matching" label="Match this category…" icon={<GitCompareArrowsIcon />} variant="outline" disabled={Boolean(busyReason)} disabledReason={busyReason} />
              )}
              <BanCategoryButton
                category={target}
                impact={{ subcategories: category.children_count, direct: true, products: category.subtree_product_count, listed: category.listed_product_count }}
                afterBanHref={parent ? `/categories/${parent.id}` : treeHref}
              />
            </>
          ) : null
        }
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Products incl. sub-categories" value={formatNumber(category.listed_product_count)} href={`/products?category_id=${category.id}`} />
        {extra ? (
          <StatCard label="Filed in other categories" value={formatNumber(category.listed_product_count - category.subtree_product_count)} />
        ) : (
          <StatCard label="Direct products" value={formatNumber(category.product_count)} />
        )}
        <StatCard label="Sub-categories" value={formatNumber(category.children_count)} />
        <StatCard label="Last seen" value={formatDateTime(category.last_seen_at)} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {children.error ? (
            <ApiUnavailable message={children.error} />
          ) : children.data && children.data.items.length > 0 ? (
            <Panel title="Sub-categories">
              <ul className="flex flex-wrap gap-2">
                {children.data.items.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/categories/${c.id}`}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition hover:border-primary/40 hover:bg-primary/5 ${c.status === "missing" ? "text-muted-foreground line-through" : ""}`}
                    >
                      {c.name}
                      {c.role === "extra" && !extra ? <ExtraCategoryBadge compact /> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel
            title="Products"
            description={extra ? "Listed by this category and its sub-categories, most recently seen first" : "Including sub-categories, most recently seen first"}
            actions={<PanelLink href={`/products?category_id=${category.id}`}>All products</PanelLink>}
          >
            {products.error ? (
              <ApiUnavailable message={products.error} />
            ) : products.data && products.data.items.length > 0 ? (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {products.data.items.map((p) => (
                  <li key={p.id}>
                    <ProductCard product={p} competitor={competitor?.name} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No products in this category yet" />
            )}
          </Panel>
        </div>

        <Panel title="Details">
          <DefinitionList
            columns={1}
            items={[
              { label: "External ID", value: category.external_id ? <code className="text-xs">{category.external_id}</code> : "—" },
              { label: "Slug", value: category.slug ?? "—" },
              { label: "Depth", value: category.depth ?? "—" },
              { label: "First seen", value: formatDateTime(category.first_seen_at) },
              { label: "Missing since", value: category.missing_since ? formatDateTime(category.missing_since) : "—" },
            ]}
          />
          {Object.keys(category.details ?? {}).length > 0 ? (
            <div className="mt-5 border-t pt-4">
              <KeyValueList data={category.details} />
            </div>
          ) : null}
        </Panel>
      </div>
    </>
  );
}
