import Link from "next/link";
import { BanIcon, ChevronRightIcon } from "lucide-react";
import { CategoryMenu, type CategoryTarget } from "@/components/category-actions";
import { CategoryTabs } from "@/components/category-tabs";
import { FilterBar, FilterSelect, FilterToggle } from "@/components/filters";
import { ApiUnavailable, EmptyState, PageHeader, Panel, StatusBadge, ToneBadge } from "@/components/kit";
import { LiveRefresh } from "@/components/live";
import { apiFetch, settle } from "@/lib/api";
import { formatDateTime, formatNumber, formatRelative, labelize } from "@/lib/format";
import { boolFlag, text, type SearchParams } from "@/lib/params";
import type { BannedCategory, CategoryTreeNode, Competitor, Paginated } from "@/lib/types";

export const metadata = { title: "Categories" };

// Banned categories shown in the tree, under their parent.
const BANNED_SHOWN = 200;

type TreeContext = {
  competitor: Omit<CategoryTarget, "id" | "name">;
  busyReason: string | null;
  // Banned categories by the current id of their parent ("root" without one in the tree).
  banned: Map<number | "root", BannedCategory[]>;
  bannedHref: string;
};

function descendants(node: CategoryTreeNode): number {
  return (node.children ?? []).reduce((sum, child) => sum + 1 + descendants(child), 0);
}

function BannedRows({ items, href }: { items: BannedCategory[]; href: string }) {
  return items.map((ban) => (
    <li key={`ban-${ban.id}`} className="pl-6">
      <div className="flex flex-wrap items-center gap-2 py-1 text-muted-foreground">
        <BanIcon className="size-3.5 shrink-0" aria-hidden />
        <Link href={href} className="text-sm line-through decoration-muted-foreground/50 hover:text-foreground" title={ban.reason ?? undefined}>
          {ban.name}
        </Link>
        <ToneBadge tone="danger">Banned</ToneBadge>
        <span className="ml-auto text-xs" title={formatDateTime(ban.banned_at)}>
          banned {formatRelative(ban.banned_at)}
        </span>
      </div>
    </li>
  ));
}

function TreeNodes({ nodes, depth = 0, context, banned = [] }: { nodes: CategoryTreeNode[]; depth?: number; context: TreeContext; banned?: BannedCategory[] }) {
  return (
    <ul className={depth === 0 ? "space-y-0.5" : "mt-0.5 space-y-0.5 border-l pl-4"}>
      {nodes.map((node) => {
        const bannedBelow = context.banned.get(node.id) ?? [];
        const hasChildren = (node.children?.length ?? 0) + bannedBelow.length > 0;
        const row = (
          <div className="flex flex-wrap items-center gap-2 py-1">
            <Link href={`/categories/${node.id}`} className={`text-sm hover:text-primary ${node.status === "missing" ? "text-muted-foreground line-through" : ""}`}>
              {node.name}
            </Link>
            {node.status === "missing" ? <StatusBadge status="missing" /> : null}
            {node.kind ? <ToneBadge>{labelize(node.kind)}</ToneBadge> : null}
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">{formatNumber(node.subtree_product_count)} products</span>
            <CategoryMenu
              category={{ ...context.competitor, id: node.id, name: node.name }}
              impact={{ subcategories: descendants(node), direct: false, products: node.subtree_product_count }}
              busyReason={context.busyReason}
            />
          </div>
        );
        if (!hasChildren) {
          return (
            <li key={node.id} className="pl-6">
              {row}
            </li>
          );
        }
        return (
          <li key={node.id}>
            <details open={depth < 1} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-1 hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-90" aria-hidden />
                <div className="min-w-0 flex-1">{row}</div>
              </summary>
              <TreeNodes nodes={node.children ?? []} depth={depth + 1} context={context} banned={bannedBelow} />
            </details>
          </li>
        );
      })}
      <BannedRows items={banned} href={context.bannedHref} />
    </ul>
  );
}

function treeIds(nodes: CategoryTreeNode[], ids = new Set<number>()): Set<number> {
  for (const node of nodes) {
    ids.add(node.id);
    treeIds(node.children ?? [], ids);
  }
  return ids;
}

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const competitors = await settle(apiFetch<Competitor[]>("/competitors"));
  const first = competitors.data?.[0]?.key;
  const selected = text(sp.competitor, 64) ?? first;
  const includeMissing = boolFlag(sp.include_missing) ?? false;
  const competitor = competitors.data?.find((c) => c.key === selected);

  const [tree, banned] = selected
    ? await Promise.all([
        settle(apiFetch<CategoryTreeNode[]>("/categories/tree", { query: { competitor: selected, include_missing: includeMissing } })),
        settle(apiFetch<Paginated<BannedCategory>>("/categories/banned", { query: { competitor: selected, limit: BANNED_SHOWN } })),
      ])
    : [null, null];

  const ids = treeIds(tree?.data ?? []);
  const bannedByParent = new Map<number | "root", BannedCategory[]>();
  for (const ban of banned?.data?.items ?? []) {
    const parent = ban.parent_category_id && ids.has(ban.parent_category_id) ? ban.parent_category_id : "root";
    bannedByParent.set(parent, [...(bannedByParent.get(parent) ?? []), ban]);
  }
  const bannedHref = `/categories/banned?competitor=${encodeURIComponent(selected ?? "")}`;
  const context: TreeContext | null = competitor
    ? {
        competitor: {
          competitorKey: competitor.key,
          competitorName: competitor.name,
          isReference: competitor.worker.tasks?.matching?.reason === "matching_reference",
        },
        busyReason: competitor.worker.state !== "idle" ? "The worker of this competitor is busy with another job" : null,
        banned: bannedByParent,
        bannedHref,
      }
    : null;

  return (
    <>
      {selected ? <LiveRefresh on={["job.status", "competitor.updated"]} competitor={selected} /> : null}
      <PageHeader
        title="Categories"
        description="The category tree of a competitor, with product counts including sub-categories. Use the ⋯ menu of a category to scrape, match or ban it."
        tabs={selected ? <CategoryTabs competitor={selected} active="tree" banned={banned?.data?.total ?? competitor?.stats.banned_categories} /> : undefined}
        toolbar={
          <FilterBar>
            <FilterSelect name="competitor" label="Competitor" defaultValue={first} options={(competitors.data ?? []).map((c) => ({ value: c.key, label: c.name }))} />
            <FilterToggle name="include_missing" label="Missing categories" anyLabel="Current only" options={[{ value: "1", label: "Include missing" }]} />
          </FilterBar>
        }
      />

      {competitors.error ? <ApiUnavailable message={competitors.error} /> : null}

      <Panel>
        {!selected || !context ? (
          <EmptyState title="No competitor selected" />
        ) : tree?.error ? (
          <ApiUnavailable message={tree.error} />
        ) : tree?.data && (tree.data.length > 0 || bannedByParent.size > 0) ? (
          <TreeNodes nodes={tree.data} context={context} banned={bannedByParent.get("root")} />
        ) : (
          <EmptyState title="No categories yet">Run a catalog sync for this competitor to discover its categories.</EmptyState>
        )}
      </Panel>
    </>
  );
}
