import { DefinitionList, ProgressBar, StatusBadge } from "@/components/ui";
import { formatDateTime, formatDuration, formatNumber, labelize } from "@/lib/format";
import type { Job } from "@/lib/types";

const ACTIVE = new Set(["queued", "running", "paused"]);

export function isActiveJob(job: Pick<Job, "status">) {
  return ACTIVE.has(job.status);
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
