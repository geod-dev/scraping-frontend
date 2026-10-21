import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { CategoryMenu, type CategoryTarget } from "@/components/category-actions";
import { FilterBar, FilterSelect, FilterToggle } from "@/components/filters";
import { ApiUnavailable, EmptyState, PageHeader, Panel, StatusBadge, ToneBadge } from "@/components/kit";
import { LiveRefresh } from "@/components/live";
import { apiFetch, settle } from "@/lib/api";
import { formatNumber, labelize } from "@/lib/format";
import { boolFlag, text, type SearchParams } from "@/lib/params";
import type { CategoryTreeNode, Competitor } from "@/lib/types";

export const metadata = { title: "Categories" };

type TreeContext = {
  competitor: Omit<CategoryTarget, "id" | "name">;
  busyReason: string | null;
};

function descendants(node: CategoryTreeNode): number {
  return (node.children ?? []).reduce((sum, child) => sum + 1 + descendants(child), 0);
}

function TreeNodes({ nodes, depth = 0, context }: { nodes: CategoryTreeNode[]; depth?: number; context: TreeContext }) {
  return (
    <ul className={depth === 0 ? "space-y-0.5" : "mt-0.5 space-y-0.5 border-l pl-4"}>
      {nodes.map((node) => {
        const hasChildren = (node.children?.length ?? 0) > 0;
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
              <TreeNodes nodes={node.children ?? []} depth={depth + 1} context={context} />
            </details>
          </li>
        );
      })}
    </ul>
  );
}

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const competitors = await settle(apiFetch<Competitor[]>("/competitors"));
  const first = competitors.data?.[0]?.key;
  const selected = text(sp.competitor, 64) ?? first;
  const includeMissing = boolFlag(sp.include_missing) ?? false;
  const competitor = competitors.data?.find((c) => c.key === selected);

  const tree = selected ? await settle(apiFetch<CategoryTreeNode[]>("/categories/tree", { query: { competitor: selected, include_missing: includeMissing } })) : null;

  const context: TreeContext | null = competitor
    ? {
        competitor: {
          competitorKey: competitor.key,
          competitorName: competitor.name,
          isReference: competitor.worker.tasks?.matching?.reason === "matching_reference",
        },
        busyReason: competitor.worker.state !== "idle" ? "The worker of this competitor is busy with another job" : null,
      }
    : null;
  // Banned categories are out of scope: left out of the tree, reachable from a discreet link.
  const banned = competitor?.stats.banned_categories ?? 0;

  return (
    <>
      {selected ? <LiveRefresh on={["job.status", "competitor.updated"]} competitor={selected} /> : null}
      <PageHeader
        title="Categories"
        description="The category tree of a competitor, with product counts including sub-categories. Use the ⋯ menu of a category to scrape, match or ban it."
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
        ) : tree?.data && tree.data.length > 0 ? (
          <TreeNodes nodes={tree.data} context={context} />
        ) : (
          <EmptyState title="No categories yet">Run a catalog sync for this competitor to discover its categories.</EmptyState>
        )}
      </Panel>

      {selected && banned > 0 ? (
        <p className="mt-3 text-right text-xs text-muted-foreground">
          <Link href={`/categories/banned?competitor=${encodeURIComponent(selected)}`} className="hover:text-foreground hover:underline">
            {banned === 1 ? "1 category banned" : `${formatNumber(banned)} categories banned`}
          </Link>
        </p>
      ) : null}
    </>
  );
}
