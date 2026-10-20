import Link from "next/link";
import { ApiUnavailable, Badge, Card, EmptyState, FilterBar, Field, PageHeader, StatusBadge, inputClass, primaryButton } from "@/components/ui";
import { apiFetch, settle } from "@/lib/api";
import { formatNumber, labelize } from "@/lib/format";
import { boolFlag, text, type SearchParams } from "@/lib/params";
import type { Competitor, CategoryTreeNode } from "@/lib/types";

export const metadata = { title: "Categories" };

function TreeNodes({ nodes, depth = 0 }: { nodes: CategoryTreeNode[]; depth?: number }) {
  return (
    <ul className={depth === 0 ? "space-y-1" : "mt-1 space-y-1 border-l border-slate-200 pl-4"}>
      {nodes.map((node) => {
        const hasChildren = (node.children?.length ?? 0) > 0;
        const row = (
          <div className="flex flex-wrap items-center gap-2 py-1">
            <Link href={`/categories/${node.id}`} className={`text-sm hover:text-indigo-600 ${node.status === "missing" ? "text-slate-400 line-through" : "text-slate-800"}`}>
              {node.name}
            </Link>
            {node.status === "missing" ? <StatusBadge status="missing" /> : null}
            {node.kind ? <Badge>{labelize(node.kind)}</Badge> : null}
            <span className="ml-auto text-xs tabular-nums text-slate-500">
              {formatNumber(node.subtree_product_count)} products
            </span>
          </div>
        );
        if (!hasChildren) {
          return (
            <li key={node.id} className="pl-5">
              {row}
            </li>
          );
        }
        return (
          <li key={node.id}>
            <details open={depth < 1} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-1 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                <span className="text-slate-400 transition group-open:rotate-90">›</span>
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
  const selected = text(sp.competitor, 64) ?? competitors.data?.[0]?.key;
  const includeMissing = boolFlag(sp.include_missing) ?? false;

  const tree = selected
    ? await settle(apiFetch<CategoryTreeNode[]>("/categories/tree", { query: { competitor: selected, include_missing: includeMissing } }))
    : null;

  return (
    <>
      <PageHeader title="Categories" description="The competitor's category tree, with product counts including sub-categories." />

      <FilterBar>
        <Field label="Competitor">
          <select className={inputClass} name="competitor" defaultValue={selected ?? ""}>
            {competitors.data?.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex h-9 items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="include_missing" value="1" defaultChecked={includeMissing} className="size-4 rounded border-slate-300 text-indigo-600" />
          Include missing categories
        </label>
        <button type="submit" className={primaryButton}>
          Apply
        </button>
      </FilterBar>

      {competitors.error ? <ApiUnavailable message={competitors.error} /> : null}

      <Card padded={false}>
        {!selected ? (
          <div className="p-5">
            <EmptyState title="No competitor selected" />
          </div>
        ) : tree?.error ? (
          <div className="p-5">
            <ApiUnavailable message={tree.error} />
          </div>
        ) : tree?.data && tree.data.length > 0 ? (
          <div className="p-5">
            <TreeNodes nodes={tree.data} />
          </div>
        ) : (
          <div className="p-5">
            <EmptyState title="No categories yet">Run a catalog sync for this competitor to discover its categories.</EmptyState>
          </div>
        )}
      </Card>
    </>
  );
}
