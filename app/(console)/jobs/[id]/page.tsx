import { notFound } from "next/navigation";
import { PauseIcon, PlayIcon, RotateCcwIcon, SquareIcon, Trash2Icon } from "lucide-react";
import { deleteJob, jobControl, restartJob } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { EstimateLine, isActiveJob, isRestartableJob, JobOrigin } from "@/components/job-progress";
import { ApiUnavailable, DefinitionList, KeyValueList, Notice, PageHeader, Panel, PanelLink, StatusBadge } from "@/components/kit";
import { LiveRefresh } from "@/components/live";
import { LiveJobProgress } from "@/components/live-job";
import { apiFetch, isApiError, settle } from "@/lib/api";
import { formatDateTime, formatDuration, labelize } from "@/lib/format";
import type { Competitor, Job } from "@/lib/types";

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
        <PageHeader title="Job" breadcrumbs={[{ label: "Jobs", href: "/jobs" }]} />
        <ApiUnavailable message={isApiError(error) ? error.message : "Unexpected error."} />
      </>
    );
  }

  const competitors = await settle(apiFetch<Competitor[]>("/competitors"));
  const competitorName = competitors.data?.find((c) => c.key === job.competitor_key)?.name ?? job.competitor_key;
  const active = isActiveJob(job);
  const canPause = job.status === "running" || job.status === "queued";
  const canResume = job.status === "paused";

  return (
    <>
      <LiveRefresh on={["job.status"]} jobId={job.id} />
      <PageHeader
        breadcrumbs={[{ label: "Jobs", href: "/jobs" }, { label: `#${job.id}` }]}
        title={`${labelize(job.task)} · ${competitorName}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={job.status} />
            Job #{job.id} · requested by {job.requested_by} · created {formatDateTime(job.created_at)}
            <JobOrigin job={job} />
          </span>
        }
        actions={
          <>
            {canPause ? <ActionButton action={jobControl} input={{ id: job.id, action: "pause" }} label="Pause" icon={<PauseIcon />} /> : null}
            {canResume ? <ActionButton action={jobControl} input={{ id: job.id, action: "resume" }} label="Resume" icon={<PlayIcon />} variant="default" /> : null}
            {active ? (
              <ActionButton
                action={jobControl}
                input={{ id: job.id, action: "cancel" }}
                label="Cancel"
                icon={<SquareIcon />}
                variant="destructive"
                confirmTitle="Cancel this job?"
                confirmMessage="Progress already saved is kept; the job can be restarted later."
                confirmLabel="Cancel job"
              />
            ) : null}
            {isRestartableJob(job) ? (
              <ActionButton
                action={restartJob}
                input={{ id: job.id }}
                label="Restart"
                icon={<RotateCcwIcon />}
                pendingLabel="Restarting…"
                variant="default"
                title="Create a new job that continues this one, skipping the work already done"
                confirmTitle="Restart this job?"
                confirmMessage="A new job continues it and skips the work already done."
                confirmLabel="Restart"
                followResult
              />
            ) : null}
            {active ? null : (
              <ActionButton
                action={deleteJob}
                input={{ id: job.id }}
                label="Delete"
                icon={<Trash2Icon />}
                variant="destructive"
                confirmTitle="Delete this job from the history?"
                confirmMessage="Its run and the data it collected are kept."
                confirmLabel="Delete"
                redirectTo="/jobs"
              />
            )}
          </>
        }
      />

      {job.error ? (
        <div className="mb-6">
          <Notice tone="danger" title="The job reported an error">
            <pre className="mt-1 whitespace-pre-wrap break-words font-sans">{job.error}</pre>
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Progress">
            <LiveJobProgress job={job} />
          </Panel>

          <Panel title="Counters" description="Totals reported by the worker">
            <KeyValueList data={job.counters} empty="No counters reported yet." />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Timeline">
            <DefinitionList
              columns={2}
              items={[
                { label: "Created", value: formatDateTime(job.created_at) },
                { label: "Started", value: formatDateTime(job.started_at) },
                { label: "Paused", value: formatDateTime(job.paused_at) },
                { label: "Finished", value: formatDateTime(job.finished_at) },
                { label: "Last heartbeat", value: formatDateTime(job.heartbeat_at) },
                { label: "Duration", value: formatDuration(job.duration_seconds) },
              ]}
            />
          </Panel>

          <Panel title="Related">
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between gap-3">
                <span className="text-muted-foreground">Competitor</span>
                <PanelLink href={`/competitors/${job.competitor_key}`}>{competitorName}</PanelLink>
              </li>
              {job.scrape_run_id ? (
                <li className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Scrape run</span>
                  <PanelLink href={`/runs/${job.scrape_run_id}`}>Run #{job.scrape_run_id}</PanelLink>
                </li>
              ) : null}
              {job.resumed_from_job_id ? (
                <li className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Continues</span>
                  <PanelLink href={`/jobs/${job.resumed_from_job_id}`}>Job #{job.resumed_from_job_id}</PanelLink>
                </li>
              ) : null}
              {job.task === "matching" ? (
                <>
                  <li className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Results</span>
                    <PanelLink href={`/matching/review?competitor=${job.competitor_key}`}>Review queue</PanelLink>
                  </li>
                  <li className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Events</span>
                    <PanelLink href={`/matching/history?job_id=${job.id}`}>Events of this run</PanelLink>
                  </li>
                </>
              ) : null}
            </ul>
          </Panel>

          {job.estimate ? (
            <Panel title="Initial estimate">
              <EstimateLine estimate={job.estimate} className="text-sm" />
              {job.estimate.basis && job.estimate.basis.length > 0 ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                  {job.estimate.basis.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </Panel>
          ) : null}

          <Panel title="Options">
            <KeyValueList data={job.options} empty="Default options." />
          </Panel>
        </div>
      </div>
    </>
  );
}
