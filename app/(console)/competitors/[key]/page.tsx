import Link from "next/link";
import { notFound } from "next/navigation";
import { restartJob, workerControl } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { AutoRefresh } from "@/components/auto-refresh";
import { EstimateSummary, isActiveJob, isRestartableJob, JobOrigin, JobProgress } from "@/components/job-progress";
import { StartTaskForm } from "@/components/start-task-form";
import { ApiUnavailable, Badge, Card, DefinitionList, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { apiFetch, isApiError, settle } from "@/lib/api";
import { formatDateTime, formatNumber, formatRelative, labelize } from "@/lib/format";
import { TASK_UNAVAILABLE_LABELS } from "@/lib/matching";
import type { CompetitorDetail, Estimate, MatchingSummary, TaskName } from "@/lib/types";

const TASKS: { task: TaskName; label: string; description: string }[] = [
  { task: "catalog_sync", label: "Sync catalog", description: "Discover categories and products across the site." },
  { task: "price_refresh", label: "Refresh prices", description: "Re-read prices for products already in the catalog." },
  { task: "matching", label: "Match with Antalis", description: "Associate each product with its Antalis equivalent. No web page is fetched." },
];

export default async function CompetitorDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;

  let competitor: CompetitorDetail;
  try {
    competitor = await apiFetch<CompetitorDetail>(`/competitors/${encodeURIComponent(key)}`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    return (
      <>
        <PageHeader title="Competitor" />
        <ApiUnavailable message={isApiError(error) ? error.message : "Unexpected error."} />
      </>
    );
  }

  const { worker } = competitor;
  const job = worker.job;
  const state = worker.state;
  const canPause = state === "running" || state === "queued";
  const canResume = state === "paused";
  const canStop = state !== "idle";
  // The reference catalog itself is never matched.
  const isReference = worker.tasks?.matching?.reason === "matching_reference";
  const tasks = TASKS.filter((t) => !(t.task === "matching" && isReference));
  const matching = isReference
    ? null
    : await settle(apiFetch<MatchingSummary[]>("/matching/summary", { query: { competitor: competitor.key } }));
  const matchingSummary = matching?.data?.[0] ?? null;
  const estimates = Object.entries(competitor.estimates ?? {}).filter((entry): entry is [string, Estimate] => Boolean(entry[1]));

  return (
    <>
      <PageHeader
        title={competitor.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <a href={competitor.base_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-500">
              {competitor.base_url}
            </a>
            <code className="text-xs">{competitor.key}</code>
            {competitor.enabled ? null : <Badge tone="warning">Disabled</Badge>}
          </span>
        }
        actions={<StatusBadge status={state} label={`Worker ${labelize(state)}`} />}
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Categories" value={formatNumber(competitor.stats.categories)} href={`/categories?competitor=${competitor.key}`} />
        <StatCard
          label="Active products"
          value={formatNumber(competitor.stats.products_active)}
          hint={`${formatNumber(competitor.stats.products_missing)} missing`}
          href={`/products?competitor=${competitor.key}`}
        />
        <StatCard label="Observations" value={formatNumber(competitor.stats.observations)} />
        <StatCard label="Last price seen" value={formatRelative(competitor.stats.last_price_observed_at)} />
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card
            title="Current job"
            description={job ? `Job #${job.id} · ${labelize(job.task)} · started by ${job.requested_by}` : "No job is running for this competitor."}
            actions={job ? <Link href={`/jobs/${job.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">Open job →</Link> : null}
          >
            {job && isActiveJob(job) ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <AutoRefresh enabled />
                  <JobOrigin job={job} />
                </div>
                <JobProgress job={job} />
              </div>
            ) : job ? (
              <DefinitionList
                items={[
                  { label: "Status", value: <StatusBadge status={job.status} /> },
                  { label: "Finished", value: formatDateTime(job.finished_at) },
                  { label: "Error", value: job.error ?? "—" },
                ]}
              />
            ) : (
              <p className="text-sm text-slate-500">Idle. Start a task below when you want fresh data.</p>
            )}
          </Card>

          <Card title="Controls" description="Start, pause, resume or stop the worker for this competitor.">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                {canPause ? (
                  <ActionButton action={workerControl} input={{ key: competitor.key, action: "pause" }} label="Pause" variant="secondary" />
                ) : null}
                {canResume ? (
                  <ActionButton action={workerControl} input={{ key: competitor.key, action: "resume" }} label="Resume" variant="primary" />
                ) : null}
                {canStop ? (
                  <ActionButton
                    action={workerControl}
                    input={{ key: competitor.key, action: "stop" }}
                    label="Stop"
                    variant="danger"
                    confirmMessage="Stop the active job for this competitor?"
                  />
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {tasks.map(({ task, label, description }) => {
                  const availability = worker.tasks?.[task];
                  const allowed = availability ? availability.allowed : true;
                  const reason = availability?.reason ? TASK_UNAVAILABLE_LABELS[availability.reason] ?? labelize(availability.reason) : null;
                  return (
                    <div key={task} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{label}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
                        {task === "matching" ? (
                          <p className="mt-1 text-xs text-slate-500">
                            The first run can take about 1 hour (embedding provider limit); later runs are fast.{" "}
                            <Link href="/matching" className="text-indigo-600 hover:text-indigo-500">
                              Matching overview →
                            </Link>
                          </p>
                        ) : null}
                        {!allowed && reason ? <p className="mt-2 text-xs text-amber-700">Unavailable: {reason}</p> : null}
                      </div>
                      <StartTaskForm
                        competitorKey={competitor.key}
                        competitorName={competitor.name}
                        task={task}
                        label={`Start ${label.toLowerCase()}`}
                        disabled={!allowed || state !== "idle"}
                        disabledReason={reason}
                        firstMatchingRun={
                          task === "matching" && matchingSummary
                            ? matchingSummary.eligible_products > 0 && matchingSummary.never_matched >= matchingSummary.eligible_products
                            : undefined
                        }
                      />
                    </div>
                  );
                })}
              </div>
              {isReference ? (
                <p className="text-xs text-slate-500">This competitor is the reference catalog for matching: its products are not matched themselves.</p>
              ) : null}
            </div>
          </Card>

          {matchingSummary ? (
            <Card
              title="Matching"
              description={`${formatNumber(matchingSummary.eligible_products)} eligible products · last computed ${formatRelative(matchingSummary.last_computed_at)}`}
              actions={
                <Link href={`/matching/matches?competitor=${competitor.key}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                  All matches →
                </Link>
              }
            >
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Needs review" value={formatNumber(matchingSummary.needs_review)} href={`/matching/review?competitor=${competitor.key}`} tone={matchingSummary.needs_review ? "warning" : "default"} />
                <StatCard label="Never matched" value={formatNumber(matchingSummary.never_matched)} />
                <StatCard label="Obsolete" value={formatNumber(matchingSummary.deprecated)} href={`/matching/deprecated?competitor=${competitor.key}`} tone={matchingSummary.deprecated ? "warning" : "default"} />
                <StatCard label="Associated" value={formatNumber((matchingSummary.counts.auto_matched ?? 0) + (matchingSummary.counts.validated ?? 0))} />
              </div>
            </Card>
          ) : null}

          {worker.last_job ? (
            <Card
              title="Last job"
              description={`#${worker.last_job.id} · ${labelize(worker.last_job.task)}`}
              actions={
                isRestartableJob(worker.last_job) ? (
                  <ActionButton
                    action={restartJob}
                    input={{ id: worker.last_job.id }}
                    label="Restart"
                    pendingLabel="Restarting…"
                    variant="primary"
                    disabled={state !== "idle"}
                    title={state !== "idle" ? "The worker is busy" : "Continue this job, skipping the work already done"}
                    confirmMessage={`Restart job #${worker.last_job.id}? A new job continues it and skips the work already done.`}
                    followResult
                  />
                ) : null
              }
            >
              <DefinitionList
                items={[
                  { label: "Status", value: <StatusBadge status={worker.last_job.status} /> },
                  { label: "Created", value: formatDateTime(worker.last_job.created_at) },
                  { label: "Finished", value: formatDateTime(worker.last_job.finished_at) },
                  { label: "Duration", value: worker.last_job.duration_seconds != null ? `${Math.round(worker.last_job.duration_seconds)} s` : "—" },
                  {
                    label: "Requested by",
                    value: (
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {worker.last_job.requested_by}
                        <JobOrigin job={worker.last_job} />
                      </span>
                    ),
                  },
                ]}
              />
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card title="Sync status">
            <DefinitionList
              items={[
                { label: "Last catalog sync", value: formatDateTime(competitor.last_full_catalog_at) },
                { label: "Catalog status", value: competitor.last_full_catalog_status ? labelize(competitor.last_full_catalog_status) : "—" },
                { label: "Last price refresh", value: formatDateTime(competitor.last_price_refresh_at) },
                { label: "Adapter", value: <code className="text-xs">{competitor.adapter}</code> },
              ]}
            />
          </Card>

          <Card title="Estimates" description="Expected duration, credits and embeddings per task, with default options">
            {estimates.length > 0 ? (
              <div className="space-y-5">
                {estimates.map(([task, estimate]) => (
                  <div key={task}>
                    <p className="mb-2 text-sm font-medium text-slate-900">{labelize(task)}</p>
                    <EstimateSummary estimate={estimate} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No estimate available.</p>
            )}
          </Card>

          <Card title="Configuration">
            <pre className="max-h-96 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
              {JSON.stringify(competitor.config ?? {}, null, 2)}
            </pre>
          </Card>
        </div>
      </div>
    </>
  );
}
