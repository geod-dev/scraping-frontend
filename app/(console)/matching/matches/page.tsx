import Link from "next/link";
import { MatchFilters, MatchTable } from "@/components/match-list";
import { MatchingTabs } from "@/components/matching";
import { ApiUnavailable, Badge, EmptyState, PageHeader, Pagination } from "@/components/ui";
import { apiFetch, settle } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { parseMatchFilters } from "@/lib/match-filters";
import { buildQuery, positiveInt, type SearchParams } from "@/lib/params";
import type { Competitor, MatchListItem, Paginated } from "@/lib/types";

export const metadata = { title: "All matches" };

const PAGE_SIZE = 25;

export default async function MatchesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filters = parseMatchFilters(sp, "matches");
  const offset = positiveInt(sp.offset, 0);

  const [competitors, matches] = await Promise.all([
    settle(apiFetch<Competitor[]>("/competitors")),
    settle(apiFetch<Paginated<MatchListItem>>("/matching/matches", { query: { ...filters.query, limit: PAGE_SIZE, offset } })),
  ]);

  const antalisProductId = filters.state.antalisProductId;

  return (
    <>
      <PageHeader
        title="Matching"
        description={matches.data ? `${formatNumber(matches.data.total)} matches with these filters` : "Every competitor product and its Antalis equivalent"}
      />
      <MatchingTabs active="/matching/matches" />

      <MatchFilters kind="matches" filters={filters} competitors={competitors.data ?? []} />

      {antalisProductId ? (
        <div className="-mt-2 mb-5 flex items-center gap-2 text-sm text-slate-600">
          <Badge tone="info">Associated with or proposing Antalis product #{antalisProductId}</Badge>
          <Link href={`/matching/matches?${buildQuery({ ...filters.values, antalis_product_id: undefined })}`} className="text-xs font-medium text-indigo-600">
            Clear
          </Link>
        </div>
      ) : null}

      {matches.error ? <ApiUnavailable message={matches.error} /> : null}

      {matches.data ? (
        matches.data.items.length === 0 ? (
          <EmptyState title="No matches found">Matches appear once a matching run has scored the competitor products.</EmptyState>
        ) : (
          <>
            <MatchTable kind="matches" items={matches.data.items} values={filters.values} offset={matches.data.offset} />
            <Pagination basePath="/matching/matches" query={filters.values} total={matches.data.total} limit={matches.data.limit} offset={matches.data.offset} />
          </>
        )
      ) : null}
    </>
  );
}
