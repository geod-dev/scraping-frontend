import Link from "next/link";
import { cn } from "@/lib/utils";
import { Notice, ProgressBar, StatusBadge, ToneBadge } from "@/components/kit";
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

export function jobPercent(job: Pick<Job, "progress" | "step_done" | "step_goal">): number | null {
  return job.progress.percent ?? (job.step_goal ? (job.step_done / job.step_goal) * 100 : null);
}

export function jobBarTone(status: Job["status"]) {
  return status === "paused" ? "amber" : status === "failed" ? "rose" : status === "succeeded" ? "emerald" : "primary";
}

// "Auto resume" badge and link to the job this one continues.
export function JobOrigin({ job }: { job: Pick<Job, "requested_by" | "resumed_from_job_id"> }) {
  if (job.requested_by !== "auto_resume" && !job.resumed_from_job_id) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      {job.requested_by === "auto_resume" ? <ToneBadge tone="violet">Auto resume</ToneBadge> : <ToneBadge>Restart</ToneBadge>}
      {job.resumed_from_job_id ? (
        <Link href={`/jobs/${job.resumed_from_job_id}`} className="text-primary hover:text-primary/80">
          continues #{job.resumed_from_job_id}
        </Link>
      ) : null}
    </span>
  );
}

// One-line estimate: duration · requests · credits · products.
export function EstimateLine({ estimate, className }: { estimate: Estimate; className?: string }) {
  const parts = [
    estimate.seconds != null ? `~${formatDuration(estimate.seconds)}` : null,
    estimate.requests != null ? `${formatNumber(estimate.requests)} ${estimate.task === "matching" ? "Voyage requests" : "requests"}` : null,
    estimate.task !== "matching" && estimate.credits != null ? `${formatNumber(estimate.credits)} credits` : null,
    estimate.task === "catalog_sync" && estimate.listing_pages != null ? `${formatNumber(estimate.listing_pages)} listing pages` : null,
    estimate.products != null ? `${formatNumber(estimate.products)} ${estimate.task === "matching" ? "products to score" : "products"}` : null,
    estimate.embeddings != null ? `${formatNumber(estimate.embeddings)} texts to embed` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <p className={cn("text-xs text-muted-foreground", className)} title={estimate.basis?.join("\n")}>
      <span className="font-medium text-foreground/70">Estimate:</span> {parts.join(" · ")}
    </p>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}

export function JobProgress({ job }: { job: Job }) {
  const progress = job.progress;
  const percent = jobPercent(job);
  const requests =
    progress.requests_total != null
      ? `${formatNumber(progress.requests_done)} / ${formatNumber(progress.requests_total)}${progress.requests_total_is_estimate ? " (est.)" : ""}`
      : formatNumber(progress.requests_done);

  return (
    <div className="space-y-5">
      {job.resumed_from_job_id && job.task === "catalog_sync" && isActiveJob(job) ? (
        <Notice>
          This sync continues job #{job.resumed_from_job_id}. Category pages already fetched are replayed from the database without any
          request or credit, so the progress bar moves quickly through that part.
        </Notice>
      ) : null}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            <StatusBadge status={job.status} />
            <span className="text-muted-foreground">{job.step_label ?? labelize(job.step)}</span>
          </div>
          <span className="font-semibold tabular-nums">{Math.round(percent ?? 0)}%</span>
        </div>
        <ProgressBar value={percent} tone={jobBarTone(job.status)} />
      </div>

      {/* A single step would only repeat the global label, bar and counters above. */}
      {progress.steps && progress.steps.length > 1 ? (
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {progress.steps.map((step) => (
            <li key={step.name} className="rounded-lg border px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{step.label}</span>
                <StatusBadge status={step.status} label={labelize(step.status)} />
              </div>
              {step.goal != null ? (
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {formatNumber(step.done ?? 0)} / {formatNumber(step.goal)}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Figure label="Requests" value={requests} />
        <Figure label="Errors" value={formatNumber(progress.errors ?? 0)} />
        <Figure label="Elapsed" value={formatDuration(progress.elapsed_seconds)} />
        <Figure label="Time left" value={formatDuration(progress.eta_seconds)} />
        <Figure label="Estimated finish" value={formatDateTime(progress.estimated_finish_at)} />
        <Figure label="Seconds / request" value={progress.seconds_per_request != null ? `${progress.seconds_per_request.toFixed(2)} s` : "—"} />
      </div>
    </div>
  );
}
