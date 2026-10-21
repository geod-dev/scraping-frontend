import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { CategoryMenu, type CategoryTarget } from "@/components/category-actions";
import { FilterBar, FilterSelect, FilterToggle } from "@/components/filters";
import { ApiUnavailable, EmptyState, PageHeader, Panel, StatusBadge, ToneBadge } from "@/components/kit";
import { LiveRefresh } from "@/components/live";
import { apiFetch, settle } from "@/lib/api";
import { treeOfRole, type RoleTreeNode } from "@/lib/categories";
import { formatNumber, labelize } from "@/lib/format";
import { boolFlag, text, type SearchParams } from "@/lib/params";
import type { CategoryTreeNode, Competitor } from "@/lib/types";

export const metadata = { title: "Categories" };

type TreeContext = {
  competitor: Omit<CategoryTarget, "id" | "name">;
  busyReason: string | null;
};

// One tree of `treeOfRole`. A header (an ancestor of the other role, kept for the hierarchy)
// is plain text: its own page and actions belong to the other tree.
function TreeNodes({ nodes, depth = 0, context }: { nodes: RoleTreeNode[]; depth?: number; context: TreeContext }) {
  return (
    <ul className={depth === 0 ? "space-y-0.5" : "mt-0.5 space-y-0.5 border-l pl-4"}>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const row = node.header ? (
          <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">{node.name}</div>
        ) : (
          <div className="group/row flex flex-wrap items-center gap-2 py-1">
            <Link href={`/categories/${node.id}`} className={`text-sm hover:text-primary ${node.status === "missing" ? "text-muted-foreground line-through" : ""}`}>
              {node.name}
            </Link>
            {node.status === "missing" ? <StatusBadge status="missing" /> : null}
            {node.kind ? <ToneBadge>{labelize(node.kind)}</ToneBadge> : null}
            <span className="ml-auto flex shrink-0 items-center gap-1">
              <span className="text-xs text-muted-foreground tabular-nums">{formatNumber(node.listed_product_count)} products</span>
              <CategoryMenu
                category={{ ...context.competitor, id: node.id, name: node.name }}
                impact={{ subcategories: node.descendants, direct: false, products: node.subtree_product_count, listed: node.listed_product_count }}
                busyReason={context.busyReason}
              />
            </span>
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
            <details open={depth < 1 || node.header} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-1 hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-90" aria-hidden />
                <div className="min-w-0 flex-1">{row}</div>
              </summary>
              <TreeNodes nodes={node.children} depth={depth + 1} context={context} />
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
  // Main tree: every product once. Extra tree: the categories listing products filed elsewhere
  // (promotions, pallet sales...), absent for most competitors.
  const mainTree = treeOfRole(tree?.data ?? [], "main");
  const extraTree = treeOfRole(tree?.data ?? [], "extra");

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
        description="The category tree of a competitor, with the products each category shows (sub-categories included)."
        toolbar={
          <FilterBar>
            <FilterSelect name="competitor" label="Competitor" defaultValue={first} options={(competitors.data ?? []).map((c) => ({ value: c.key, label: c.name }))} />
            <FilterToggle name="include_missing" label="Missing categories" anyLabel="Current only" options={[{ value: "1", label: "Include missing" }]} />
          </FilterBar>
        }
      />

      {competitors.error ? <ApiUnavailable message={competitors.error} /> : null}

      <Panel
        title={extraTree.length > 0 ? "Main categories" : undefined}
        description={extraTree.length > 0 ? "Every product is filed in exactly one of them." : undefined}
      >
        {!selected || !context ? (
          <EmptyState title="No competitor selected" />
        ) : tree?.error ? (
          <ApiUnavailable message={tree.error} />
        ) : mainTree.length > 0 ? (
          <TreeNodes nodes={mainTree} context={context} />
        ) : extraTree.length > 0 ? (
          <EmptyState title="No main categories" />
        ) : (
          <EmptyState title="No categories yet">Run a catalog sync for this competitor to discover its categories.</EmptyState>
        )}
      </Panel>

      {context && extraTree.length > 0 ? (
        <Panel
          className="mt-6"
          title="Extra categories"
          description="Merchandising categories (promotions, pallet sales…): they list products filed in a main category. Their main parents show in grey."
        >
          <TreeNodes nodes={extraTree} context={context} />
        </Panel>
      ) : null}

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
