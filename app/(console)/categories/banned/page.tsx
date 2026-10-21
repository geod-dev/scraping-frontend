import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";
import { UnbanButton } from "@/components/category-actions";
import { FilterBar, FilterSearch, FilterSelect } from "@/components/filters";
import { ApiUnavailable, EmptyState, PageHeader, Pagination } from "@/components/kit";
import { LiveRefresh } from "@/components/live";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch, settle } from "@/lib/api";
import { formatDateTime, formatDeleted, formatNumber, formatRelative } from "@/lib/format";
import { positiveInt, text, type SearchParams } from "@/lib/params";
import type { BannedCategory, Competitor, Paginated } from "@/lib/types";

export const metadata = { title: "Banned categories" };

const PAGE_SIZE = 25;

// Breadcrumb entries are names or objects with a name, depending on the adapter.
function breadcrumbText(breadcrumb: unknown[] | null): string | null {
  const names = (breadcrumb ?? [])
    .map((entry) => (typeof entry === "string" ? entry : entry && typeof entry === "object" ? ((entry as { name?: unknown; label?: unknown }).name ?? (entry as { label?: unknown }).label) : null))
    .filter((name): name is string => typeof name === "string" && name.trim() !== "");
  return names.length > 0 ? names.join(" › ") : null;
}

export default async function BannedCategoriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const competitors = await settle(apiFetch<Competitor[]>("/competitors"));
  const first = competitors.data?.[0]?.key;
  const selected = text(sp.competitor, 64) ?? first;
  const q = text(sp.q, 200);
  const offset = positiveInt(sp.offset, 0);

  const banned = selected
    ? await settle(apiFetch<Paginated<BannedCategory>>("/categories/banned", { query: { competitor: selected, q, limit: PAGE_SIZE, offset } }))
    : null;

  return (
    <>
      {selected ? <LiveRefresh on={["competitor.updated"]} competitor={selected} /> : null}
      <PageHeader
        breadcrumbs={[{ label: "Categories", href: selected ? `/categories?competitor=${encodeURIComponent(selected)}` : "/categories" }, { label: "Banned" }]}
        title="Banned categories"
        description="Deleted with their sub-categories, products, prices and matches, and skipped by every catalog sync. Unbanning recreates a category empty, under a new id."
        toolbar={
          <FilterBar>
            <FilterSelect name="competitor" label="Competitor" defaultValue={first} options={(competitors.data ?? []).map((c) => ({ value: c.key, label: c.name }))} />
            <FilterSearch name="q" placeholder="Search a name or URL…" label="Search" />
          </FilterBar>
        }
      />

      {competitors.error ? <ApiUnavailable message={competitors.error} /> : null}
      {banned?.error ? <ApiUnavailable message={banned.error} /> : null}

      {banned?.data ? (
        banned.data.items.length === 0 ? (
          <EmptyState title={q ? "No banned category matches this search" : "No banned category"}>
            {q ? null : "Ban a category from the ⋯ menu of the category tree, or from its page."}
          </EmptyState>
        ) : (
          <>
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Category</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Banned</TableHead>
                    <TableHead>Deleted</TableHead>
                    <TableHead className="pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banned.data.items.map((ban) => {
                    const path = breadcrumbText(ban.breadcrumb);
                    return (
                      <TableRow key={ban.id}>
                        <TableCell className="max-w-96 pl-4 align-top whitespace-normal">
                          <p className="font-medium">{ban.name}</p>
                          {path ? <p className="truncate text-xs text-muted-foreground" title={path}>{path}</p> : null}
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                            <a href={ban.url} target="_blank" rel="noreferrer" className="inline-flex max-w-72 items-center gap-1 text-primary hover:text-primary/80" title={ban.url}>
                              <span className="truncate">{ban.url.replace(/^https?:\/\/[^/]+/, "") || ban.url}</span>
                              <ExternalLinkIcon className="size-3 shrink-0" />
                            </a>
                            {ban.parent_category_id ? (
                              <Link href={`/categories/${ban.parent_category_id}`} className="text-muted-foreground hover:text-foreground">
                                Parent category →
                              </Link>
                            ) : null}
                          </p>
                        </TableCell>
                        <TableCell className="max-w-64 align-top whitespace-normal text-sm">{ban.reason ?? <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="align-top text-sm">
                          <p title={formatDateTime(ban.banned_at)}>{formatRelative(ban.banned_at)}</p>
                          <p className="text-xs text-muted-foreground">{ban.banned_by ? `by ${ban.banned_by}` : "by an unknown user"}</p>
                        </TableCell>
                        <TableCell className="max-w-72 align-top whitespace-normal text-xs text-muted-foreground">{formatDeleted(ban.deleted)}</TableCell>
                        <TableCell className="pr-4 text-right align-top">
                          <UnbanButton ban={ban} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
            <Pagination basePath="/categories/banned" query={{ competitor: selected, q }} total={banned.data.total} limit={banned.data.limit} offset={banned.data.offset} />
            <p className="mt-3 text-xs text-muted-foreground">{formatNumber(banned.data.total)} banned, newest first.</p>
          </>
        )
      ) : null}
    </>
  );
}
