import { MatchFilters, MatchTable } from "@/components/match-list";
import { MatchingTabs } from "@/components/matching";
import { RerunDeprecatedButton } from "@/components/rerun-deprecated-button";
import { ApiUnavailable, EmptyState, PageHeader, Pagination } from "@/components/ui";
import { apiFetch, settle } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { parseMatchFilters } from "@/lib/match-filters";
import { positiveInt, type SearchParams } from "@/lib/params";
import type { Competitor, MatchListItem, Paginated } from "@/lib/types";

export const metadata = { title: "Obsolete matches" };

const PAGE_SIZE = 25;

export default async function DeprecatedMatchesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filters = parseMatchFilters(sp, "deprecated");
  const offset = positiveInt(sp.offset, 0);

  const [competitors, matches] = await Promise.all([
    settle(apiFetch<Competitor[]>("/competitors")),
    settle(apiFetch<Paginated<MatchListItem>>("/matching/deprecated", { query: { ...filters.query, limit: PAGE_SIZE, offset } })),
  ]);

  return (
    <>
      <PageHeader
        title="Obsolete matches"
        description={
          matches.data
            ? `${formatNumber(matches.data.total)} matches became obsolete because a product changed. The former association stays visible until the next run.`
            : "Matches to recompute because a product changed"
        }
        actions={<RerunDeprecatedButton competitor={filters.state.competitor} disabled={matches.data?.total === 0} />}
      />
      <MatchingTabs active="/matching/deprecated" />

      <MatchFilters kind="deprecated" filters={filters} competitors={competitors.data ?? []} />

      {matches.error ? <ApiUnavailable message={matches.error} /> : null}

      {matches.data ? (
        matches.data.items.length === 0 ? (
          <EmptyState title="No obsolete match">Matches become obsolete when the competitor or the Antalis product changes.</EmptyState>
        ) : (
          <>
            <MatchTable kind="deprecated" items={matches.data.items} values={filters.values} offset={matches.data.offset} />
            <Pagination basePath="/matching/deprecated" query={filters.values} total={matches.data.total} limit={matches.data.limit} offset={matches.data.offset} />
          </>
        )
      ) : null}
    </>
  );
}
