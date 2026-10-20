import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteJob, jobControl } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { AutoRefresh } from "@/components/auto-refresh";
import { isActiveJob, JobProgress } from "@/components/job-progress";
import { ApiUnavailable, Card, DefinitionList, PageHeader, StatusBadge } from "@/components/ui";
import { apiFetch, isApiError } from "@/lib/api";
import { formatDateTime, formatDuration, labelize } from "@/lib/format";
import type { Job } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Job ${id}` };
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId) || jobId <= 0) notFound();

  let job: Job;
  try {
    job = await apiFetch<Job>(`/jobs/${jobId}`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    return (
      <>
        <PageHeader title="Job" />
        <ApiUnavailable message={isApiError(error) ? error.message : "Unexpected error."} />
      </>
    );
  }

  const active = isActiveJob(job);
  const canPause = job.status === "running" || job.status === "queued";
  const canResume = job.status === "paused";

  return (
    <>
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/jobs" className="hover:text-slate-900">
          Jobs
        </Link>
        <span> / #{job.id}</span>
      </nav>

      <PageHeader
        title={`${labelize(job.task)} · ${job.competitor_key}`}
        description={`Job #${job.id} · requested by ${job.requested_by} · created ${formatDateTime(job.created_at)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AutoRefresh enabled={active} />
            <StatusBadge status={job.status} />
            {canPause ? (
              <ActionButton action={jobControl} input={{ id: job.id, action: "pause" }} label="Pause" variant="secondary" />
            ) : null}
            {canResume ? (
              <ActionButton action={jobControl} input={{ id: job.id, action: "resume" }} label="Resume" variant="primary" />
            ) : null}
            {active ? (
              <ActionButton
                action={jobControl}
                input={{ id: job.id, action: "cancel" }}
                label="Cancel"
                variant="danger"
                confirmMessage="Cancel this job? Progress already saved is kept."
              />
            ) : (
              <ActionButton
                action={deleteJob}
                input={{ id: job.id }}
                label="Delete"
                variant="danger"
                confirmMessage="Delete this finished job from history?"
                redirectTo="/jobs"
              />
            )}
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Progress">
            <JobProgress job={job} />
          </Card>

          {job.error ? (
            <Card title="Error">
              <pre className="whitespace-pre-wrap break-words rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{job.error}</pre>
            </Card>
          ) : null}

          <Card title="Counters" description="Totals reported by the worker">
            {Object.keys(job.counters ?? {}).length > 0 ? (
              <pre className="max-h-96 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(job.counters, null, 2)}</pre>
            ) : (
              <p className="text-sm text-slate-500">No counters reported yet.</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Timeline">
            <DefinitionList
              items={[
                { label: "Created", value: formatDateTime(job.created_at) },
                { label: "Started", value: formatDateTime(job.started_at) },
                { label: "Paused", value: formatDateTime(job.paused_at) },
                { label: "Finished", value: formatDateTime(job.finished_at) },
                { label: "Last heartbeat", value: formatDateTime(job.heartbeat_at) },
                { label: "Duration", value: formatDuration(job.duration_seconds) },
              ]}
            />
          </Card>

          <Card title="Run">
            <DefinitionList
              items={[
                {
                  label: "Scrape run",
                  value: job.scrape_run_id ? (
                    <Link href={`/runs/${job.scrape_run_id}`} className="text-indigo-600 hover:text-indigo-500">
                      Run #{job.scrape_run_id}
                    </Link>
                  ) : (
                    "—"
                  ),
                },
                { label: "Competitor", value: job.competitor_key },
                { label: "Estimate", value: job.estimate ? `${formatDuration(job.estimate.seconds)} · ${job.estimate.credits ?? "?"} credits` : "—" },
              ]}
            />
          </Card>

          <Card title="Options">
            <pre className="max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(job.options ?? {}, null, 2)}</pre>
          </Card>
        </div>
      </div>
    </>
  );
}
