import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { isActiveJob, JobOrigin } from "@/components/job-progress";
import { MatchStatusBadge, MatchingTabs } from "@/components/matching";
import { RerunDeprecatedButton } from "@/components/rerun-deprecated-button";
import { StartTaskForm } from "@/components/start-task-form";
import { ApiUnavailable, Badge, Card, EmptyState, Notice, PageHeader, ProgressBar, StatusBadge } from "@/components/ui";
import { apiFetch, settle } from "@/lib/api";
import { formatDateTime, formatNumber, formatRelative, labelize } from "@/lib/format";
import { MATCH_STATUSES, TASK_UNAVAILABLE_LABELS } from "@/lib/matching";
import { buildQuery } from "@/lib/params";
import type { MatchingConfig, MatchingSummary } from "@/lib/types";

export const metadata = { title: "Matching" };

export default async function MatchingOverviewPage() {
  const [summary, config] = await Promise.all([
    settle(apiFetch<MatchingSummary[]>("/matching/summary")),
    settle(apiFetch<MatchingConfig>("/matching/config")),
  ]);

  const anyActive = summary.data?.some((s) => s.job && isActiveJob(s.job)) ?? false;
  const totalDeprecated = summary.data?.reduce((sum, s) => sum + s.deprecated, 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Matching"
        description="Each competitor product is associated with its equivalent in the Antalis reference catalog."
        actions={
          <div className="flex items-start gap-3">
            <AutoRefresh enabled={anyActive} />
            <RerunDeprecatedButton disabled={totalDeprecated === 0} />
          </div>
        }
      />
      <MatchingTabs active="/matching" />

      {config.data && !config.data.configured ? (
        <div className="mb-6">
          <Notice tone="warning">Matching is not configured on the server (no Voyage API key): runs cannot start.</Notice>
        </div>
      ) : null}

      {summary.error ? <ApiUnavailable message={summary.error} /> : null}

      {summary.data ? (
        summary.data.length === 0 ? (
          <EmptyState title="No competitor to match">Competitors other than Antalis appear here once configured.</EmptyState>
        ) : (
          <div className="space-y-6">
            {summary.data.map((s) => (
              <CompetitorMatching key={s.competitor_key} summary={s} />
            ))}
          </div>
        )
      ) : null}

      {config.data ? (
        <Card title="Engine" description={`Reference catalog: ${config.data.reference_competitor} · engine ${config.data.engine_version}`} className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Thresholds</p>
              <ul className="mt-2 space-y-1 text-sm">
                {Object.entries(config.data.thresholds).map(([key, value]) => (
                  <li key={key} className="flex justify-between gap-4">
                    <span className="text-slate-600">{labelize(key)}</span>
                    <span className="tabular-nums text-slate-900">{value}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Weights</p>
              <ul className="mt-2 space-y-1 text-sm">
                {Object.entries(config.data.weights).map(([profile, weights]) => (
                  <li key={profile} className="flex justify-between gap-4">
                    <span className="text-slate-600">{labelize(profile)}</span>
                    <span className="text-xs tabular-nums text-slate-900">
                      {Object.entries(weights)
                        .map(([k, v]) => `${k} ${v}`)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      ) : null}
    </>
  );
}

function CompetitorMatching({ summary: s }: { summary: MatchingSummary }) {
  const job = s.job;
  // Nothing matched yet: the run embeds every product text.
  const firstRun = s.eligible_products > 0 && s.never_matched >= s.eligible_products;
  const reason = s.availability.allowed
    ? null
    : (s.availability.message ?? (s.availability.reason ? TASK_UNAVAILABLE_LABELS[s.availability.reason] : "Unavailable"));
  const listHref = (status?: string) => `/matching/matches?${buildQuery({ competitor: s.competitor_key, status })}`;

  return (
    <Card
      title={s.competitor_name}
      description={`${formatNumber(s.eligible_products)} eligible products · last computed ${formatRelative(s.last_computed_at)}`}
      actions={
        <Link href={`/competitors/${s.competitor_key}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          Competitor →
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Figure label="Needs review" value={s.needs_review} href={`/matching/review?competitor=${s.competitor_key}`} tone={s.needs_review ? "warning" : undefined} />
            <Figure label="Never matched" value={s.never_matched} />
            <Figure label="Obsolete" value={s.deprecated} href={`/matching/deprecated?competitor=${s.competitor_key}`} tone={s.deprecated ? "warning" : undefined} />
            <Figure label="Embedding tokens" value={s.embedding_tokens} />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Matches by status</p>
            <ul className="flex flex-wrap gap-2">
              {MATCH_STATUSES.map((status) => (
                <li key={status}>
                  <Link href={listHref(status)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 hover:border-indigo-300">
                    <MatchStatusBadge status={status} />
                    <span className="text-sm font-semibold tabular-nums text-slate-900">{formatNumber(s.counts[status] ?? 0)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {s.outdated_by_config ? (
              <p className="mt-2 text-xs text-slate-500">
                {formatNumber(s.outdated_by_config)} results were computed with an older configuration; the next incremental run refreshes them.
              </p>
            ) : null}
          </div>

          {job && isActiveJob(job) ? (
            <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={job.status} />
                  <Link href={`/jobs/${job.id}`} className="font-medium text-indigo-600 hover:text-indigo-500">
                    Job #{job.id}
                  </Link>
                  <span className="text-slate-600">{job.step_label ?? labelize(job.step)}</span>
                  <JobOrigin job={job} />
                </span>
                <span className="font-semibold tabular-nums">{Math.round(job.progress.percent ?? 0)}%</span>
              </div>
              <ProgressBar value={job.progress.percent} tone={job.status === "paused" ? "amber" : "indigo"} />
            </div>
          ) : s.last_job ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              Last run:
              <Link href={`/jobs/${s.last_job.id}`} className="text-indigo-600 hover:text-indigo-500">
                #{s.last_job.id}
              </Link>
              <StatusBadge status={s.last_job.status} />
              <span className="text-slate-500">{formatDateTime(s.last_job.finished_at)}</span>
              {s.last_job.options?.mode ? <Badge tone="neutral">{labelize(String(s.last_job.options.mode))}</Badge> : null}
            </p>
          ) : (
            <p className="text-sm text-slate-500">No matching run yet.</p>
          )}
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-900">Run matching</p>
          {firstRun ? (
            <Notice tone="warning">
              The first run embeds the whole catalog: allow about 1 hour (embedding provider rate limit). Later runs only embed what
              changed and are fast.
            </Notice>
          ) : null}
          {reason ? <p className="text-xs text-amber-700">Unavailable: {reason}</p> : null}
          <StartTaskForm
            competitorKey={s.competitor_key}
            competitorName={s.competitor_name}
            task="matching"
            label="Start matching"
            disabled={!s.availability.allowed}
            disabledReason={reason}
            firstMatchingRun={firstRun}
          />
        </div>
      </div>
    </Card>
  );
}

function Figure({ label, value, href, tone }: { label: string; value: number; href?: string; tone?: "warning" }) {
  const body = (
    <div className={`rounded-lg border px-3 py-2.5 ${tone === "warning" ? "border-amber-200 bg-amber-50/40" : "border-slate-200"} ${href ? "hover:border-indigo-300" : ""}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{formatNumber(value)}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
