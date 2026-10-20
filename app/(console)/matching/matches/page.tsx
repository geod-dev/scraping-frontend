import { ApiUnavailable, EmptyState, PageHeader, Pagination } from "@/components/kit";
import { LiveRefresh } from "@/components/live";
import { MatchFilters, MatchTable } from "@/components/match-list";
import { MatchingTabs } from "@/components/matching-tabs";
import { apiFetch, settle } from "@/lib/api";
import { categoryOptions } from "@/lib/categories";
import { formatNumber } from "@/lib/format";
import { parseMatchFilters } from "@/lib/match-filters";
import { scoreThresholds } from "@/lib/matching";
import { positiveInt, type SearchParams } from "@/lib/params";
import type { Competitor, MatchListItem, MatchingConfig, Paginated } from "@/lib/types";

export const metadata = { title: "All matches" };

const PAGE_SIZE = 25;

export default async function MatchesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filters = parseMatchFilters(sp, "matches");
  const offset = positiveInt(sp.offset, 0);

  const [competitors, matches, config, categories] = await Promise.all([
    settle(apiFetch<Competitor[]>("/competitors")),
    settle(apiFetch<Paginated<MatchListItem>>("/matching/matches", { query: { ...filters.query, limit: PAGE_SIZE, offset } })),
    settle(apiFetch<MatchingConfig>("/matching/config")),
    categoryOptions(filters.state.competitor),
  ]);

  return (
    <>
      <LiveRefresh on={["matching.updated"]} />
      <PageHeader
        title="All matches"
        description={matches.data ? `${formatNumber(matches.data.total)} matches with these filters` : "Every competitor product and its Antalis equivalent"}
        tabs={<MatchingTabs active="/matching/matches" />}
        toolbar={<MatchFilters kind="matches" filters={filters} competitors={competitors.data ?? []} categories={categories} />}
      />

      {matches.error ? <ApiUnavailable message={matches.error} /> : null}

      {matches.data ? (
        matches.data.items.length === 0 ? (
          <EmptyState title="No matches found">Matches appear once a matching run has scored the competitor products. Try removing filters.</EmptyState>
        ) : (
          <>
            <MatchTable kind="matches" items={matches.data.items} values={filters.values} offset={matches.data.offset} thresholds={scoreThresholds(config.data)} />
            <Pagination basePath="/matching/matches" query={filters.values} total={matches.data.total} limit={matches.data.limit} offset={matches.data.offset} />
          </>
        )
      ) : null}
    </>
  );
}
