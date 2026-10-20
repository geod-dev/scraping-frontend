import { FilterBar, FilterField, FilterGroup, FilterNumber, FilterSearch, FilterSelect, FilterSheet } from "@/components/filters";
import { ApiUnavailable, EmptyState, FilterChips, PageHeader, Pagination } from "@/components/kit";
import { LiveRefresh } from "@/components/live";
import { MatchEventList } from "@/components/matching";
import { MatchingTabs } from "@/components/matching-tabs";
import { Card } from "@/components/ui/card";
import { apiFetch, settle } from "@/lib/api";
import { clearFiltersHref, filterChips } from "@/lib/filter-chips";
import { formatNumber } from "@/lib/format";
import { MATCH_EVENTS, MATCH_EVENT_LABELS } from "@/lib/matching";
import { oneOf, positiveInt, text, type SearchParams } from "@/lib/params";
import type { Competitor, MatchEvent, MatchEventKind, Paginated } from "@/lib/types";

export const metadata = { title: "Matching history" };

const PAGE_SIZE = 50;

export default async function MatchingHistoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const competitor = text(sp.competitor, 64);
  const productId = positiveInt(sp.product_id, 0) || undefined;
  const event = oneOf(sp.event, MATCH_EVENTS);
  const jobId = positiveInt(sp.job_id, 0) || undefined;
  const actor = text(sp.actor, 100);
  const offset = positiveInt(sp.offset, 0);

  const [competitors, events] = await Promise.all([
    settle(apiFetch<Competitor[]>("/competitors")),
    settle(
      apiFetch<Paginated<MatchEvent>>("/matching/history", {
        query: { competitor, product_id: productId, event: event ? [event] : undefined, job_id: jobId, actor, limit: PAGE_SIZE, offset },
      }),
    ),
  ]);

  const names = new Map(competitors.data?.map((c) => [c.key, c.name]));
  const values = { competitor, event, product_id: productId ? String(productId) : undefined, job_id: jobId ? String(jobId) : undefined, actor };
  const chips = filterChips("/matching/history", values, [
    { name: "competitor", label: "Competitor", format: (v) => names.get(v) ?? v },
    { name: "event", label: "Event", format: (v) => MATCH_EVENT_LABELS[v as MatchEventKind] ?? v },
    { name: "product_id", label: "Product", format: (v) => `#${v}` },
    { name: "job_id", label: "Job", format: (v) => `#${v}` },
    { name: "actor", label: "Actor" },
  ]);
  const clearHref = clearFiltersHref("/matching/history", values);

  return (
    <>
      <LiveRefresh on={["matching.updated"]} />
      <PageHeader
        title="Matching history"
        description={events.data ? `${formatNumber(events.data.total)} events: every computation and decision on the matches` : "Every computation and decision on the matches"}
        tabs={<MatchingTabs active="/matching/history" />}
        toolbar={
          <FilterBar>
            <FilterSelect name="competitor" label="Competitor" allLabel="All competitors" options={(competitors.data ?? []).map((c) => ({ value: c.key, label: c.name }))} />
            <FilterSelect name="event" label="Event" allLabel="All events" options={MATCH_EVENTS.map((e) => ({ value: e, label: MATCH_EVENT_LABELS[e] }))} />
            <FilterSheet count={chips.filter((c) => ["product_id", "job_id", "actor"].includes(c.key)).length} clearHref={clearHref}>
              <FilterGroup title="Narrow down">
                <FilterField label="Actor" hint="“engine” or a reviewer name">
                  <FilterSearch name="actor" label="Actor" placeholder="engine, a reviewer…" className="w-full" />
                </FilterField>
                <FilterField label="Competitor product ID">
                  <FilterNumber name="product_id" label="Product ID" min={1} className="w-full" />
                </FilterField>
                <FilterField label="Matching job ID">
                  <FilterNumber name="job_id" label="Job ID" min={1} className="w-full" />
                </FilterField>
              </FilterGroup>
            </FilterSheet>
            <FilterChips chips={chips} clearHref={clearHref} />
          </FilterBar>
        }
      />

      {events.error ? <ApiUnavailable message={events.error} /> : null}

      {events.data ? (
        events.data.items.length === 0 ? (
          <EmptyState title="No events">No matching event matches these filters.</EmptyState>
        ) : (
          <>
            <Card className="py-0">
              <MatchEventList events={events.data.items} showProduct />
            </Card>
            <Pagination basePath="/matching/history" query={values} total={events.data.total} limit={events.data.limit} offset={events.data.offset} />
          </>
        )
      ) : null}
    </>
  );
}
