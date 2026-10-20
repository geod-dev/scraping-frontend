import Link from "next/link";
import { ApiUnavailable, EmptyState, PageHeader, Pagination } from "@/components/kit";
import { LiveRefresh } from "@/components/live";
import { MatchFilters, MatchTable } from "@/components/match-list";
import { MatchingTabs } from "@/components/matching-tabs";
import { buttonVariants } from "@/components/ui/button";
import { apiFetch, settle } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { parseMatchFilters, reviewHref } from "@/lib/match-filters";
import { scoreThresholds } from "@/lib/matching";
import { positiveInt, type SearchParams } from "@/lib/params";
import type { Competitor, MatchListItem, MatchingConfig, Paginated } from "@/lib/types";

export const metadata = { title: "Review queue" };

const PAGE_SIZE = 25;

export default async function ReviewQueuePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filters = parseMatchFilters(sp, "review");
  const offset = positiveInt(sp.offset, 0);

  const [competitors, queue, config] = await Promise.all([
    settle(apiFetch<Competitor[]>("/competitors")),
    settle(apiFetch<Paginated<MatchListItem>>("/matching/review", { query: { ...filters.query, limit: PAGE_SIZE, offset } })),
    settle(apiFetch<MatchingConfig>("/matching/config")),
  ]);

  const first = queue.data?.items[0];

  return (
    <>
      <LiveRefresh on={["matching.updated"]} />
      <PageHeader
        title="Review queue"
        description={queue.data ? `${formatNumber(queue.data.total)} products wait for a human decision, best scores first.` : "Products whose proposal needs a human decision"}
        tabs={<MatchingTabs active="/matching/review" />}
        actions={
          first ? (
            <Link href={reviewHref(first.product.id, { kind: "review", values: filters.values, position: offset })} className={buttonVariants({ size: "lg" })}>
              Start reviewing →
            </Link>
          ) : null
        }
        toolbar={<MatchFilters kind="review" filters={filters} competitors={competitors.data ?? []} />}
      />

      {queue.error ? <ApiUnavailable message={queue.error} /> : null}

      {queue.data ? (
        queue.data.items.length === 0 ? (
          <EmptyState title="Nothing to review">Every proposal has been decided. New ones arrive after the next matching run.</EmptyState>
        ) : (
          <>
            <MatchTable kind="review" items={queue.data.items} values={filters.values} offset={queue.data.offset} thresholds={scoreThresholds(config.data)} />
            <Pagination basePath="/matching/review" query={filters.values} total={queue.data.total} limit={queue.data.limit} offset={queue.data.offset} />
          </>
        )
      ) : null}
    </>
  );
}
