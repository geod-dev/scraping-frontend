import Link from "next/link";
import { FilterBar, FilterField, FilterGroup, FilterSelect, FilterSheet, FilterToggle } from "@/components/filters";
import { ApiUnavailable, EmptyState, FilterChips, PageHeader, Pagination, RowChevron, StatusBadge, ToneBadge } from "@/components/kit";
import { LinkRow } from "@/components/link-row";
import { LiveRefresh } from "@/components/live";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch, settle } from "@/lib/api";
import { clearFiltersHref, filterChips } from "@/lib/filter-chips";
import { formatDateTime, formatDuration, formatNumber, labelize } from "@/lib/format";
import { boolFlag, oneOf, positiveInt, text, type SearchParams } from "@/lib/params";
import type { Competitor, Paginated, Run } from "@/lib/types";

export const metadata = { title: "Runs" };

const PAGE_SIZE = 25;
const OPERATIONS = ["catalog_discovery", "price_refresh"] as const;
const RUN_STATUSES = ["running", "succeeded", "partial", "failed", "aborted"] as const;

function runDuration(run: Run): number | null {
  return run.finished_at ? (new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000 : null;
}

export default async function RunsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const competitor = text(sp.competitor, 64);
  const operation = oneOf(sp.operation, OPERATIONS);
  const status = oneOf(sp.status, RUN_STATUSES);
  const fullScope = boolFlag(sp.full_scope);
  const offset = positiveInt(sp.offset, 0);

  const [competitors, runs] = await Promise.all([
    settle(apiFetch<Competitor[]>("/competitors")),
    settle(apiFetch<Paginated<Run>>("/runs", { query: { competitor, operation, status, full_scope: fullScope, limit: PAGE_SIZE, offset } })),
  ]);

  const names = new Map(competitors.data?.map((c) => [c.key, c.name]));
  const namesById = new Map(competitors.data?.map((c) => [c.id, c.name]));
  const values = { competitor, operation, status, full_scope: fullScope === undefined ? undefined : fullScope ? "1" : "0" };
  const chips = filterChips("/runs", values, [
    { name: "competitor", label: "Competitor", format: (v) => names.get(v) ?? v },
    { name: "operation", label: "Operation", format: labelize },
    { name: "status", label: "Status", format: labelize },
    { name: "full_scope", label: "Scope", format: (v) => (v === "1" ? "Full" : "Partial") },
  ]);
  const clearHref = clearFiltersHref("/runs", values);

  return (
    <>
      <LiveRefresh on={["job.status"]} />
      <PageHeader
        title="Runs"
        description={runs.data ? `${formatNumber(runs.data.total)} scrape runs, with what each discovered, created and changed` : "Every scrape run, with what it discovered, created and changed"}
        toolbar={
          <FilterBar>
            <FilterSelect name="competitor" label="Competitor" allLabel="All competitors" options={(competitors.data ?? []).map((c) => ({ value: c.key, label: c.name }))} />
            <FilterToggle name="operation" label="Operation" anyLabel="All" options={OPERATIONS.map((o) => ({ value: o, label: labelize(o) }))} />
            <FilterSheet count={chips.filter((c) => c.key === "status" || c.key === "full_scope").length} clearHref={clearHref}>
              <FilterGroup title="Run">
                <FilterField label="Status">
                  <FilterSelect name="status" label="Status" allLabel="Any status" className="w-full" options={RUN_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} />
                </FilterField>
                <FilterField label="Scope" hint="A full-scope run covers the whole catalog and marks what it did not see as missing.">
                  <FilterToggle name="full_scope" label="Scope" options={[{ value: "1", label: "Full" }, { value: "0", label: "Partial" }]} />
                </FilterField>
              </FilterGroup>
            </FilterSheet>
            <FilterChips chips={chips} clearHref={clearHref} />
          </FilterBar>
        }
      />

      {runs.error ? <ApiUnavailable message={runs.error} /> : null}

      {runs.data ? (
        runs.data.items.length === 0 ? (
          <EmptyState title="No runs match these filters" />
        ) : (
          <>
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Run</TableHead>
                    <TableHead>Competitor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Pages</TableHead>
                    <TableHead className="text-right">Products seen</TableHead>
                    <TableHead className="text-right">Created / updated</TableHead>
                    <TableHead className="text-right">Observations</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.data.items.map((run) => (
                    <LinkRow key={run.id} href={`/runs/${run.id}`}>
                      <TableCell className="pl-4">
                        <Link href={`/runs/${run.id}`} className="font-medium hover:text-primary">
                          {labelize(run.operation)} <span className="text-muted-foreground">#{run.id}</span>
                        </Link>
                        <div className="mt-0.5">{run.full_scope ? <ToneBadge tone="violet">Full scope</ToneBadge> : <span className="text-xs text-muted-foreground">Partial scope</span>}</div>
                      </TableCell>
                      <TableCell>{namesById.get(run.competitor_id) ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={run.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(run.pages_fetched)}
                        {run.pages_failed ? <div className="text-xs text-rose-600">{formatNumber(run.pages_failed)} failed</div> : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(run.products_seen)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(run.products_created)} / {formatNumber(run.products_updated)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(run.observations_created)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(run.credits_used)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(run.started_at)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatDuration(runDuration(run))}</TableCell>
                      <RowChevron />
                    </LinkRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            <Pagination basePath="/runs" query={values} total={runs.data.total} limit={runs.data.limit} offset={runs.data.offset} />
          </>
        )
      ) : null}
    </>
  );
}
