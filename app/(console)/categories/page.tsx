import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { FilterBar, FilterSelect, FilterToggle } from "@/components/filters";
import { ApiUnavailable, EmptyState, PageHeader, Panel, StatusBadge, ToneBadge } from "@/components/kit";
import { apiFetch, settle } from "@/lib/api";
import { formatNumber, labelize } from "@/lib/format";
import { boolFlag, text, type SearchParams } from "@/lib/params";
import type { CategoryTreeNode, Competitor } from "@/lib/types";

export const metadata = { title: "Categories" };

function TreeNodes({ nodes, depth = 0 }: { nodes: CategoryTreeNode[]; depth?: number }) {
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
              <TreeNodes nodes={node.children ?? []} depth={depth + 1} />
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

  const tree = selected ? await settle(apiFetch<CategoryTreeNode[]>("/categories/tree", { query: { competitor: selected, include_missing: includeMissing } })) : null;

  return (
    <>
      <PageHeader
        title="Categories"
        description="The category tree of a competitor, with product counts including sub-categories."
        toolbar={
          <FilterBar>
            <FilterSelect name="competitor" label="Competitor" defaultValue={first} options={(competitors.data ?? []).map((c) => ({ value: c.key, label: c.name }))} />
            <FilterToggle name="include_missing" label="Missing categories" anyLabel="Current only" options={[{ value: "1", label: "Include missing" }]} />
          </FilterBar>
        }
      />

      {competitors.error ? <ApiUnavailable message={competitors.error} /> : null}

      <Panel>
        {!selected ? (
          <EmptyState title="No competitor selected" />
        ) : tree?.error ? (
          <ApiUnavailable message={tree.error} />
        ) : tree?.data && tree.data.length > 0 ? (
          <TreeNodes nodes={tree.data} />
        ) : (
          <EmptyState title="No categories yet">Run a catalog sync for this competitor to discover its categories.</EmptyState>
        )}
      </Panel>
    </>
  );
}
