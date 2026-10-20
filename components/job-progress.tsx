import Link from "next/link";
import { Badge, DefinitionList, Notice, ProgressBar, StatusBadge } from "@/components/ui";
import { formatDateTime, formatDuration, formatNumber, labelize } from "@/lib/format";
import type { Estimate, Job } from "@/lib/types";

const ACTIVE = new Set(["queued", "running", "paused"]);
const RESTARTABLE = new Set(["interrupted", "failed", "cancelled"]);

export function isActiveJob(job: Pick<Job, "status">) {
  return ACTIVE.has(job.status);
}

// A new job can continue this one, skipping the work already done.
export function isRestartableJob(job: Pick<Job, "status">) {
  return RESTARTABLE.has(job.status);
}

// "Auto resume" badge and link to the job this one continues.
export function JobOrigin({ job }: { job: Pick<Job, "requested_by" | "resumed_from_job_id"> }) {
  if (job.requested_by !== "auto_resume" && !job.resumed_from_job_id) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      {job.requested_by === "auto_resume" ? <Badge tone="violet">Auto resume</Badge> : <Badge tone="neutral">Restart</Badge>}
      {job.resumed_from_job_id ? (
        <Link href={`/jobs/${job.resumed_from_job_id}`} className="text-indigo-600 hover:text-indigo-500">
          continues #{job.resumed_from_job_id}
        </Link>
      ) : null}
    </span>
  );
}

export function EstimateSummary({ estimate }: { estimate: Estimate }) {
  const items = [
    { label: "Duration", value: formatDuration(estimate.seconds) },
    { label: estimate.task === "matching" ? "Voyage requests" : "Requests", value: formatNumber(estimate.requests) },
    estimate.task === "matching" ? null : { label: "Credits", value: formatNumber(estimate.credits) },
    estimate.task === "catalog_sync" ? { label: "Listing pages", value: formatNumber(estimate.listing_pages) } : null,
    { label: estimate.task === "matching" ? "Products to score" : "Products", value: formatNumber(estimate.products) },
    estimate.task === "matching" || estimate.embeddings != null ? { label: "Texts to embed", value: formatNumber(estimate.embeddings) } : null,
  ].filter((item): item is { label: string; value: string } => item !== null);

  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-xs text-slate-500">{item.label}</dt>
            <dd className="tabular-nums text-slate-900">{item.value}</dd>
          </div>
        ))}
      </dl>
      {estimate.basis && estimate.basis.length > 0 ? (
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-500">
          {estimate.basis.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function JobProgress({ job }: { job: Job }) {
  const progress = job.progress;
  const percent = progress.percent ?? (job.step_goal ? (job.step_done / job.step_goal) * 100 : null);
  const requests =
    progress.requests_total != null
      ? `${formatNumber(progress.requests_done)} / ${formatNumber(progress.requests_total)}${progress.requests_total_is_estimate ? " (est.)" : ""}`
      : formatNumber(progress.requests_done);

  return (
    <div className="space-y-5">
      {job.resumed_from_job_id && job.task === "catalog_sync" && isActiveJob(job) ? (
        <Notice>
          This sync continues job #{job.resumed_from_job_id}. Category pages already fetched are replayed from the
          database without any request or credit, so the progress bar moves quickly through that part.
        </Notice>
      ) : null}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            <StatusBadge status={job.status} />
            <span className="text-slate-600">{job.step_label ?? labelize(job.step)}</span>
          </div>
          <span className="font-semibold tabular-nums text-slate-900">{Math.round(percent ?? 0)}%</span>
        </div>
        <ProgressBar value={percent} tone={job.status === "paused" ? "amber" : "indigo"} />
      </div>

      {progress.steps && progress.steps.length > 0 ? (
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {progress.steps.map((step) => (
            <li key={step.name} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-800">{step.label}</span>
                <StatusBadge status={step.status} label={labelize(step.status)} />
              </div>
              {step.goal != null ? (
                <p className="mt-1 text-xs tabular-nums text-slate-500">
                  {formatNumber(step.done ?? 0)} / {formatNumber(step.goal)}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      <DefinitionList
        items={[
          { label: "Requests", value: requests },
          { label: "Errors", value: formatNumber(progress.errors ?? 0) },
          { label: "Elapsed", value: formatDuration(progress.elapsed_seconds) },
          { label: "ETA", value: formatDuration(progress.eta_seconds) },
          { label: "Estimated finish", value: formatDateTime(progress.estimated_finish_at) },
          {
            label: "Seconds / request",
            value: progress.seconds_per_request != null ? `${progress.seconds_per_request.toFixed(2)} s` : "—",
          },
        ]}
      />
    </div>
  );
}
