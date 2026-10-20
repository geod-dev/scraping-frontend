import Link from "next/link";
import { ApiUnavailable, Badge, Card, EmptyState, Field, FilterBar, PageHeader, Pagination, StatusBadge, Table, Td, Th, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { apiFetch, settle } from "@/lib/api";
import { formatDateTime, formatDuration, formatNumber, labelize } from "@/lib/format";
import { boolFlag, oneOf, positiveInt, text, type SearchParams } from "@/lib/params";
import type { Competitor, Paginated, Run } from "@/lib/types";

export const metadata = { title: "Runs" };

const PAGE_SIZE = 25;

export default async function RunsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const competitor = text(sp.competitor, 64);
  const operation = oneOf(sp.operation, ["catalog_discovery", "price_refresh"] as const);
  const status = oneOf(sp.status, ["running", "succeeded", "partial", "failed", "aborted"] as const);
  const fullScope = boolFlag(sp.full_scope);
  const offset = positiveInt(sp.offset, 0);

  const [competitors, runs] = await Promise.all([
    settle(apiFetch<Competitor[]>("/competitors")),
    settle(
      apiFetch<Paginated<Run>>("/runs", {
        query: { competitor, operation, status, full_scope: fullScope, limit: PAGE_SIZE, offset },
      }),
    ),
  ]);

  const paging = {
    competitor,
    operation,
    status,
    full_scope: fullScope === undefined ? undefined : fullScope ? "1" : "0",
  };

  return (
    <>
      <PageHeader title="Runs" description="Every scrape run, with what it discovered, created and changed." />

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
        <Field label="Operation">
          <select className={inputClass} name="operation" defaultValue={operation ?? ""}>
            <option value="">Any</option>
            <option value="catalog_discovery">Catalog discovery</option>
            <option value="price_refresh">Price refresh</option>
          </select>
        </Field>
        <Field label="Status">
          <select className={inputClass} name="status" defaultValue={status ?? ""}>
            <option value="">Any</option>
            {["running", "succeeded", "partial", "failed", "aborted"].map((s) => (
              <option key={s} value={s}>
                {labelize(s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Scope">
          <select className={inputClass} name="full_scope" defaultValue={fullScope === undefined ? "" : fullScope ? "1" : "0"}>
            <option value="">Any</option>
            <option value="1">Full scope</option>
            <option value="0">Partial scope</option>
          </select>
        </Field>
        <div className="flex gap-2">
          <button type="submit" className={primaryButton}>
            Apply
          </button>
          <Link href="/runs" className={secondaryButton}>
            Reset
          </Link>
        </div>
      </FilterBar>

      {runs.error ? <ApiUnavailable message={runs.error} /> : null}

      {runs.data ? (
        runs.data.items.length === 0 ? (
          <EmptyState title="No runs match these filters" />
        ) : (
          <>
            <Card padded={false}>
              <Table>
                <thead>
                  <tr>
                    <Th>Run</Th>
                    <Th>Operation</Th>
                    <Th>Status</Th>
                    <Th align="right">Pages</Th>
                    <Th align="right">Products seen</Th>
                    <Th align="right">Created / updated</Th>
                    <Th align="right">Observations</Th>
                    <Th align="right">Credits</Th>
                    <Th>Started</Th>
                    <Th align="right">Duration</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {runs.data.items.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-50">
                      <Td>
                        <Link href={`/runs/${run.id}`} className="font-medium text-indigo-600 hover:text-indigo-500">
                          #{run.id}
                        </Link>
                        <div className="text-xs text-slate-500">{run.full_scope ? <Badge tone="violet">Full scope</Badge> : "Partial scope"}</div>
                      </Td>
                      <Td>{labelize(run.operation)}</Td>
                      <Td>
                        <StatusBadge status={run.status} />
                      </Td>
                      <Td align="right">
                        {formatNumber(run.pages_fetched)}
                        {run.pages_failed ? <span className="text-rose-600"> / {run.pages_failed} failed</span> : null}
                      </Td>
                      <Td align="right">{formatNumber(run.products_seen)}</Td>
                      <Td align="right">
                        {formatNumber(run.products_created)} / {formatNumber(run.products_updated)}
                      </Td>
                      <Td align="right">{formatNumber(run.observations_created)}</Td>
                      <Td align="right">{formatNumber(run.credits_used)}</Td>
                      <Td>
                        <span className="whitespace-nowrap">{formatDateTime(run.started_at)}</span>
                      </Td>
                      <Td align="right">{formatDuration(run.finished_at ? (new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000 : null)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
            <Pagination basePath="/runs" query={paging} total={runs.data.total} limit={runs.data.limit} offset={runs.data.offset} />
          </>
        )
      ) : null}
    </>
  );
}
