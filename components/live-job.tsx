"use client";

import { ProgressBar } from "@/components/kit";
import { JobProgress, jobBarTone, jobPercent } from "@/components/job-progress";
import { useLiveJob } from "@/components/live";
import { formatDuration, labelize } from "@/lib/format";
import type { Job } from "@/lib/types";

// Job progress kept current by the live event stream.

export function LiveJobProgress({ job }: { job: Job }) {
  return <JobProgress job={useLiveJob(job)} />;
}

// Compact progress: step and percent over a thin bar, time left below.
export function LiveJobBar({ job: initial, title }: { job: Job; title?: string }) {
  const job = useLiveJob(initial);
  const percent = jobPercent(job);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium">{title ?? job.step_label ?? labelize(job.status)}</span>
        <span className="shrink-0 font-semibold tabular-nums">{job.status === "queued" ? "Queued" : `${Math.round(percent ?? 0)}%`}</span>
      </div>
      <ProgressBar size="sm" value={percent} tone={jobBarTone(job.status)} />
      {title || job.progress.eta_seconds ? (
        <div className="flex justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{title ? (job.step_label ?? labelize(job.status)) : null}</span>
          {job.progress.eta_seconds ? <span className="shrink-0 tabular-nums">{formatDuration(job.progress.eta_seconds)} left</span> : null}
        </div>
      ) : null}
    </div>
  );
}

// Percent of a job inline (tables).
export function LiveJobPercent({ job: initial }: { job: Job }) {
  const job = useLiveJob(initial);
  const percent = jobPercent(job);
  return (
    <div className="flex min-w-32 items-center gap-2">
      <div className="flex-1">
        <ProgressBar size="sm" value={percent} tone={jobBarTone(job.status)} />
      </div>
      <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{Math.round(percent ?? 0)}%</span>
    </div>
  );
}
