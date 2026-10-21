import Link from "next/link";
import { FilterBar, FilterField, FilterGroup, FilterSelect, FilterSheet, FilterToggle } from "@/components/filters";
import { isActiveJob, JobCategory, JobOrigin } from "@/components/job-progress";
import { ApiUnavailable, EmptyState, FilterChips, PageHeader, Pagination, RowChevron, StatusBadge } from "@/components/kit";
import { LinkRow } from "@/components/link-row";
import { LiveRefresh } from "@/components/live";
import { LiveJobPercent } from "@/components/live-job";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch, settle } from "@/lib/api";
import { clearFiltersHref, filterChips } from "@/lib/filter-chips";
import { formatDateTime, formatDuration, formatNumber, formatRelative, labelize } from "@/lib/format";
import { jobCategoryNames } from "@/lib/job-categories";
import { boolFlag, oneOf, positiveInt, text, type SearchParams } from "@/lib/params";
import type { Competitor, Job, Paginated } from "@/lib/types";

export const metadata = { title: "Jobs" };

const PAGE_SIZE = 25;
const TASKS = ["catalog_sync", "price_refresh", "matching"] as const;
const JOB_STATUSES = ["queued", "running", "paused", "succeeded", "partial", "failed", "cancelled", "interrupted"] as const;

export default async function JobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const competitor = text(sp.competitor, 64);
  const task = oneOf(sp.task, TASKS);
  const status = oneOf(sp.status, JOB_STATUSES);
  const active = boolFlag(sp.active);
  const offset = positiveInt(sp.offset, 0);

  const [competitors, jobs] = await Promise.all([
    settle(apiFetch<Competitor[]>("/competitors")),
    settle(apiFetch<Paginated<Job>>("/jobs", { query: { competitor, task, status, active, limit: PAGE_SIZE, offset } })),
  ]);

  const names = new Map(competitors.data?.map((c) => [c.key, c.name]));
  const categories = await jobCategoryNames(jobs.data?.items ?? []);
  const values = { competitor, task, status, active: active === undefined ? undefined : active ? "1" : "0" };
  const chips = filterChips("/jobs", values, [
    { name: "competitor", label: "Competitor", format: (v) => names.get(v) ?? v },
    { name: "task", label: "Task", format: labelize },
    { name: "status", label: "Status", format: labelize },
    { name: "active", label: "Activity", format: (v) => (v === "1" ? "Active only" : "Finished only") },
  ]);
  const clearHref = clearFiltersHref("/jobs", values);

  return (
    <>
      <LiveRefresh on={["job.status"]} />
      <PageHeader
        title="Jobs"
        description={jobs.data ? `${formatNumber(jobs.data.total)} catalog syncs, price refreshes and matching runs, newest first` : "Catalog syncs, price refreshes and matching runs"}
        toolbar={
          <FilterBar>
            <FilterSelect name="competitor" label="Competitor" allLabel="All competitors" options={(competitors.data ?? []).map((c) => ({ value: c.key, label: c.name }))} />
            <FilterToggle name="active" label="Activity" anyLabel="All" options={[{ value: "1", label: "Active" }, { value: "0", label: "Finished" }]} />
            <FilterSheet count={chips.filter((c) => c.key === "task" || c.key === "status").length} clearHref={clearHref}>
              <FilterGroup title="Job">
                <FilterField label="Task">
                  <FilterToggle name="task" label="Task" options={TASKS.map((t) => ({ value: t, label: labelize(t) }))} />
                </FilterField>
                <FilterField label="Status">
                  <FilterSelect name="status" label="Status" allLabel="Any status" className="w-full" options={JOB_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} />
                </FilterField>
              </FilterGroup>
            </FilterSheet>
            <FilterChips chips={chips} clearHref={clearHref} />
          </FilterBar>
        }
      />

      {jobs.error ? <ApiUnavailable message={jobs.error} /> : null}

      {jobs.data ? (
        jobs.data.items.length === 0 ? (
          <EmptyState title="No jobs match these filters" />
        ) : (
          <>
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Job</TableHead>
                    <TableHead>Competitor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.data.items.map((job) => (
                    <LinkRow key={job.id} href={`/jobs/${job.id}`}>
                      <TableCell className="pl-4">
                        <Link href={`/jobs/${job.id}`} className="font-medium hover:text-primary">
                          {labelize(job.task)} <span className="text-muted-foreground">#{job.id}</span>
                        </Link>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <JobCategory job={job} names={categories} />
                          <JobOrigin job={job} />
                        </div>
                      </TableCell>
                      <TableCell>{names.get(job.competitor_key) ?? job.competitor_key}</TableCell>
                      <TableCell>
                        <StatusBadge status={job.status} />
                        {job.error ? <p className="mt-1 max-w-56 truncate text-xs text-rose-700" title={job.error}>{job.error}</p> : null}
                      </TableCell>
                      <TableCell>{isActiveJob(job) ? <LiveJobPercent job={job} /> : <span className="text-xs text-muted-foreground">{job.finished_at ? `Finished ${formatRelative(job.finished_at)}` : "—"}</span>}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(job.progress.requests_done)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(job.created_at)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatDuration(job.duration_seconds)}</TableCell>
                      <RowChevron />
                    </LinkRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            <Pagination basePath="/jobs" query={values} total={jobs.data.total} limit={jobs.data.limit} offset={jobs.data.offset} />
          </>
        )
      ) : null}
    </>
  );
}
