import Link from "next/link";
import { ApiUnavailable, EmptyState, FilterBar, Field, PageHeader, Pagination, ProgressBar, StatusBadge, Table, Td, Th, inputClass, primaryButton, secondaryButton, Card } from "@/components/ui";
import { AutoRefresh } from "@/components/auto-refresh";
import { apiFetch, settle } from "@/lib/api";
import { formatDateTime, formatDuration, formatNumber, labelize } from "@/lib/format";
import { boolFlag, oneOf, positiveInt, text, type SearchParams } from "@/lib/params";
import type { Competitor, Job, Paginated } from "@/lib/types";

export const metadata = { title: "Jobs" };

const PAGE_SIZE = 25;
const JOB_STATUSES = ["queued", "running", "paused", "succeeded", "partial", "failed", "cancelled", "interrupted"] as const;

export default async function JobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const competitor = text(sp.competitor, 64);
  const task = oneOf(sp.task, ["catalog_sync", "price_refresh"] as const);
  const status = oneOf(sp.status, JOB_STATUSES);
  const active = boolFlag(sp.active);
  const offset = positiveInt(sp.offset, 0);

  const [competitors, jobs] = await Promise.all([
    settle(apiFetch<Competitor[]>("/competitors")),
    settle(
      apiFetch<Paginated<Job>>("/jobs", {
        query: { competitor, task, status, active, limit: PAGE_SIZE, offset },
      }),
    ),
  ]);

  const hasActive = jobs.data?.items.some((j) => j.status === "queued" || j.status === "running" || j.status === "paused") ?? false;
  const paging = {
    competitor,
    task,
    status,
    active: active === undefined ? undefined : active ? "1" : "0",
  };

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Catalog syncs and price refreshes, newest first."
        actions={<AutoRefresh enabled={hasActive} />}
      />

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
        <Field label="Task">
          <select className={inputClass} name="task" defaultValue={task ?? ""}>
            <option value="">Any task</option>
            <option value="catalog_sync">Catalog sync</option>
            <option value="price_refresh">Price refresh</option>
          </select>
        </Field>
        <Field label="Status">
          <select className={inputClass} name="status" defaultValue={status ?? ""}>
            <option value="">Any status</option>
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {labelize(s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Activity">
          <select className={inputClass} name="active" defaultValue={active === undefined ? "" : active ? "1" : "0"}>
            <option value="">All</option>
            <option value="1">Active only</option>
            <option value="0">Finished only</option>
          </select>
        </Field>
        <div className="flex gap-2">
          <button type="submit" className={primaryButton}>
            Apply
          </button>
          <Link href="/jobs" className={secondaryButton}>
            Reset
          </Link>
        </div>
      </FilterBar>

      {jobs.error ? <ApiUnavailable message={jobs.error} /> : null}

      {jobs.data ? (
        jobs.data.items.length === 0 ? (
          <EmptyState title="No jobs match these filters" />
        ) : (
          <>
            <Card padded={false}>
              <Table>
                <thead>
                  <tr>
                    <Th>Job</Th>
                    <Th>Competitor</Th>
                    <Th>Status</Th>
                    <Th>Progress</Th>
                    <Th align="right">Requests</Th>
                    <Th>Created</Th>
                    <Th align="right">Duration</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobs.data.items.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-50">
                      <Td>
                        <Link href={`/jobs/${job.id}`} className="font-medium text-indigo-600 hover:text-indigo-500">
                          #{job.id}
                        </Link>
                        <div className="text-xs text-slate-500">{labelize(job.task)}</div>
                      </Td>
                      <Td>{job.competitor_key}</Td>
                      <Td>
                        <StatusBadge status={job.status} />
                      </Td>
                      <Td>
                        <div className="flex min-w-32 items-center gap-2">
                          <div className="flex-1">
                            <ProgressBar value={job.progress.percent} tone={job.status === "paused" ? "amber" : "indigo"} />
                          </div>
                          <span className="w-10 text-right text-xs tabular-nums text-slate-500">{Math.round(job.progress.percent ?? 0)}%</span>
                        </div>
                      </Td>
                      <Td align="right">{formatNumber(job.progress.requests_done)}</Td>
                      <Td>
                        <span className="whitespace-nowrap">{formatDateTime(job.created_at)}</span>
                      </Td>
                      <Td align="right">{formatDuration(job.duration_seconds)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
            <Pagination basePath="/jobs" query={paging} total={jobs.data.total} limit={jobs.data.limit} offset={jobs.data.offset} />
          </>
        )
      ) : null}
    </>
  );
}
