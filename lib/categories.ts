import { apiFetch, settle } from "@/lib/api";
import type { CategoryTreeNode } from "@/lib/types";

export type CategoryOption = { value: string; label: string; hint?: string; searchText: string; count: number };

// Every category of a competitor as a flat list in tree order, each with its parent path,
// for the category filters. Empty without a competitor or when the API is unavailable.
export async function categoryOptions(competitor: string | undefined): Promise<CategoryOption[]> {
  if (!competitor) return [];
  const tree = await settle(apiFetch<CategoryTreeNode[]>("/categories/tree", { query: { competitor } }));
  const options: CategoryOption[] = [];
  const walk = (nodes: CategoryTreeNode[], path: string[]) => {
    for (const node of nodes) {
      const hint = path.length > 0 ? path.join(" › ") : undefined;
      options.push({ value: String(node.id), label: node.name, hint, searchText: [...path, node.name].join(" "), count: node.subtree_product_count });
      walk(node.children ?? [], [...path, node.name]);
    }
  };
  walk(tree.data ?? [], []);
  return options;
}
