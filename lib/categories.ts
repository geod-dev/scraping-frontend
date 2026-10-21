import { apiFetch, settle } from "@/lib/api";
import type { CategoryRole, CategoryTreeNode } from "@/lib/types";

export type CategoryOption = { value: string; label: string; hint?: string; searchText: string; count: number; extra?: boolean };

// The tree pruned to the nodes of `role`, keeping their hierarchy: a node of the other role
// stays only as an ancestor of a kept node (`header`), and a branch without any node of `role`
// is dropped. The main tree is the catalog without duplicates; the extra tree holds the
// merchandising categories (promotions, pallet sales...) under their main ancestors.
// `descendants` counts the whole subtree, pruned nodes included (what a ban deletes).
export type RoleTreeNode = CategoryTreeNode & { header: boolean; descendants: number; children: RoleTreeNode[] };

function descendants(node: CategoryTreeNode): number {
  return (node.children ?? []).reduce((sum, child) => sum + 1 + descendants(child), 0);
}

export function treeOfRole(nodes: CategoryTreeNode[], role: CategoryRole): RoleTreeNode[] {
  return nodes.flatMap((node) => {
    const children = treeOfRole(node.children ?? [], role);
    if (node.role !== role && children.length === 0) return [];
    return [{ ...node, header: node.role !== role, descendants: descendants(node), children }];
  });
}

// Every category of a competitor as a flat list in tree order, each with its parent path,
// for the category filters: the main categories, then the extra ones (`extra`). Empty without
// a competitor or when the API is unavailable.
export async function categoryOptions(competitor: string | undefined): Promise<CategoryOption[]> {
  if (!competitor) return [];
  const tree = await settle(apiFetch<CategoryTreeNode[]>("/categories/tree", { query: { competitor } }));
  const options: CategoryOption[] = [];
  const walk = (nodes: RoleTreeNode[], path: string[]) => {
    for (const node of nodes) {
      const hint = path.length > 0 ? path.join(" › ") : undefined;
      // A header is an option of the other group: here it only lends its name to the path.
      if (!node.header) {
        options.push({ value: String(node.id), label: node.name, hint, searchText: [...path, node.name].join(" "), count: node.listed_product_count, extra: node.role === "extra" });
      }
      walk(node.children, [...path, node.name]);
    }
  };
  walk(treeOfRole(tree.data ?? [], "main"), []);
  walk(treeOfRole(tree.data ?? [], "extra"), []);
  return options;
}
