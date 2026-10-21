import { LinkTabs } from "@/components/kit";

// Tabs of the categories section of a competitor: its tree, its banned categories.
export function CategoryTabs({ competitor, active, banned }: { competitor: string; active: "tree" | "banned"; banned?: number | null }) {
  const query = `?competitor=${encodeURIComponent(competitor)}`;
  const items = [
    { href: `/categories${query}`, label: "Tree" },
    { href: `/categories/banned${query}`, label: "Banned", count: banned },
  ];
  return <LinkTabs items={items} active={items[active === "tree" ? 0 : 1].href} label="Categories" />;
}
