"use client";

import { LinkTabs } from "@/components/kit";
import { useConsoleSummary } from "@/components/live";

const TABS = [
  { href: "/matching", label: "Overview" },
  { href: "/matching/review", label: "Review queue" },
  { href: "/matching/matches", label: "All matches" },
  { href: "/matching/deprecated", label: "Obsolete" },
  { href: "/matching/history", label: "History" },
];

// Tabs of the matching section; the review queue and obsolete tabs carry their live counts.
export function MatchingTabs({ active }: { active: string }) {
  const summary = useConsoleSummary();
  const items = TABS.map((tab) => ({
    ...tab,
    count: tab.href === "/matching/review" ? summary?.matching.needs_review : tab.href === "/matching/deprecated" ? summary?.matching.deprecated : undefined,
  }));
  return <LinkTabs items={items} active={active} label="Matching" />;
}
