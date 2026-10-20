import Link from "next/link";
import { MatchEventList, MatchingTabs } from "@/components/matching";
import { ApiUnavailable, Card, EmptyState, Field, FilterBar, PageHeader, Pagination, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { apiFetch, settle } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { MATCH_EVENTS, MATCH_EVENT_LABELS } from "@/lib/matching";
import { oneOf, positiveInt, text, type SearchParams } from "@/lib/params";
import type { Competitor, MatchEvent, Paginated } from "@/lib/types";

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

  const paging = {
    competitor,
    product_id: productId ? String(productId) : undefined,
    event,
    job_id: jobId ? String(jobId) : undefined,
    actor,
  };

  return (
    <>
      <PageHeader
        title="Matching history"
        description={events.data ? `${formatNumber(events.data.total)} events` : "Every computation and decision on the matches"}
      />
      <MatchingTabs active="/matching/history" />

      <FilterBar>
        <Field label="Competitor">
          <select className={inputClass} name="competitor" defaultValue={competitor ?? ""}>
            <option value="">All competitors</option>
            {competitors.data?.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Event">
          <select className={inputClass} name="event" defaultValue={event ?? ""}>
            <option value="">Any</option>
            {MATCH_EVENTS.map((e) => (
              <option key={e} value={e}>
                {MATCH_EVENT_LABELS[e]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Product ID">
          <input className={`${inputClass} w-32`} name="product_id" type="number" min={1} defaultValue={productId ?? ""} />
        </Field>
        <Field label="Job ID">
          <input className={`${inputClass} w-28`} name="job_id" type="number" min={1} defaultValue={jobId ?? ""} />
        </Field>
        <Field label="Actor">
          <input className={`${inputClass} w-40`} name="actor" defaultValue={actor} placeholder="e.g. engine, alice" />
        </Field>
        <div className="flex gap-2">
          <button type="submit" className={primaryButton}>
            Apply
          </button>
          <Link href="/matching/history" className={secondaryButton}>
            Reset
          </Link>
        </div>
      </FilterBar>

      {events.error ? <ApiUnavailable message={events.error} /> : null}

      {events.data ? (
        events.data.items.length === 0 ? (
          <EmptyState title="No events">No matching event matches these filters.</EmptyState>
        ) : (
          <>
            <Card padded={false}>
              <MatchEventList events={events.data.items} showProduct />
            </Card>
            <Pagination basePath="/matching/history" query={paging} total={events.data.total} limit={events.data.limit} offset={events.data.offset} />
          </>
        )
      ) : null}
    </>
  );
}
