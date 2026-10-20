import Link from "next/link";
import { isActiveJob } from "@/components/job-progress";
import { ApiUnavailable, EmptyState, Notice, PageHeader, Panel, StatusBadge, ToneBadge } from "@/components/kit";
import { LiveRefresh } from "@/components/live";
import { LiveJobBar } from "@/components/live-job";
import { StatusDistribution } from "@/components/matching";
import { MatchingTabs } from "@/components/matching-tabs";
import { RerunDeprecatedButton } from "@/components/rerun-deprecated-button";
import { StartTaskForm } from "@/components/start-task-form";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch, settle } from "@/lib/api";
import { formatNumber, formatRelative, labelize } from "@/lib/format";
import { TASK_UNAVAILABLE_LABELS } from "@/lib/matching";
import { buildQuery } from "@/lib/params";
import type { MatchingConfig, MatchingSummary } from "@/lib/types";

export const metadata = { title: "Matching" };

export default async function MatchingOverviewPage() {
  const [summary, config] = await Promise.all([settle(apiFetch<MatchingSummary[]>("/matching/summary")), settle(apiFetch<MatchingConfig>("/matching/config"))]);

  const toReview = summary.data?.reduce((sum, s) => sum + s.needs_review, 0) ?? 0;
  const deprecated = summary.data?.reduce((sum, s) => sum + s.deprecated, 0) ?? 0;

  return (
    <>
      <LiveRefresh on={["matching.updated", "job.status"]} />
      <PageHeader
        title="Matching"
        description="Each competitor product is associated with its equivalent in the Antalis reference catalog."
        tabs={<MatchingTabs active="/matching" />}
        actions={
          <>
            <RerunDeprecatedButton disabled={deprecated === 0} variant="outline" />
            {toReview > 0 ? (
              <Link href="/matching/review" className={buttonVariants({ size: "lg" })}>
                Review {formatNumber(toReview)} →
              </Link>
            ) : null}
          </>
        }
      />

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
          <div className="space-y-4">
            {summary.data.map((s) => (
              <CompetitorMatching key={s.competitor_key} summary={s} />
            ))}
          </div>
        )
      ) : null}

      {config.data ? <EngineConfig config={config.data} /> : null}
    </>
  );
}

function CompetitorMatching({ summary: s }: { summary: MatchingSummary }) {
  const job = s.job && isActiveJob(s.job) ? s.job : null;
  // Nothing matched yet: the run embeds every product text.
  const firstRun = s.eligible_products > 0 && s.never_matched >= s.eligible_products;
  const reason = s.availability.allowed ? null : (s.availability.message ?? (s.availability.reason ? TASK_UNAVAILABLE_LABELS[s.availability.reason] : "Unavailable"));
  const listHref = (status: string) => `/matching/matches?${buildQuery({ competitor: s.competitor_key, status })}`;

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <Link href={`/competitors/${s.competitor_key}`} className="font-semibold hover:text-primary">
            {s.competitor_name}
          </Link>
          <p className="text-xs text-muted-foreground">
            {formatNumber(s.eligible_products)} eligible products · last computed {formatRelative(s.last_computed_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {s.deprecated > 0 ? (
            <Link href={`/matching/deprecated?competitor=${s.competitor_key}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
              {formatNumber(s.deprecated)} obsolete
            </Link>
          ) : null}
          {s.needs_review > 0 ? (
            <Link href={`/matching/review?competitor=${s.competitor_key}`} className={buttonVariants({ size: "lg" })}>
              Review {formatNumber(s.needs_review)} →
            </Link>
          ) : (
            <ToneBadge tone="success">Nothing to review</ToneBadge>
          )}
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        <StatusDistribution counts={s.counts} hrefFor={listHref} />
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground tabular-nums">{formatNumber(s.never_matched)}</span> never matched
          </span>
          {s.outdated_by_config ? (
            <span title="The next incremental run refreshes them">
              <span className="font-medium text-foreground tabular-nums">{formatNumber(s.outdated_by_config)}</span> computed with an older configuration
            </span>
          ) : null}
          <span>
            <span className="font-medium text-foreground tabular-nums">{formatNumber(s.embedding_tokens)}</span> embedding tokens
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-3 border-t bg-muted/40 px-5 py-3 md:flex-row md:items-center">
        <div className="min-w-0 flex-1 text-sm">
          {job ? (
            <Link href={`/jobs/${job.id}`} className="block max-w-md">
              <LiveJobBar job={job} title={`Matching run #${job.id}`} />
            </Link>
          ) : s.last_job ? (
            <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
              Last run
              <Link href={`/jobs/${s.last_job.id}`} className="text-primary hover:text-primary/80">
                #{s.last_job.id}
              </Link>
              <StatusBadge status={s.last_job.status} />
              {formatRelative(s.last_job.finished_at)}
              {s.last_job.options?.mode ? <ToneBadge>{labelize(String(s.last_job.options.mode))}</ToneBadge> : null}
            </p>
          ) : (
            <p className="text-muted-foreground">No matching run yet.</p>
          )}
          {reason ? <p className="mt-1 text-xs font-medium text-amber-700">Unavailable: {reason}</p> : null}
          {firstRun ? <p className="mt-1 text-xs text-amber-700">The first run embeds the whole catalog: allow a few minutes.</p> : null}
        </div>
        <StartTaskForm
          competitorKey={s.competitor_key}
          competitorName={s.competitor_name}
          task="matching"
          label="Run matching"
          disabled={!s.availability.allowed || Boolean(job)}
          disabledReason={reason ?? (job ? "A matching run is in progress" : null)}
          firstMatchingRun={firstRun}
        />
      </div>
    </Card>
  );
}

// Thresholds as tiles, weights as a profile × signal table.
function EngineConfig({ config }: { config: MatchingConfig }) {
  const signals = [...new Set(Object.values(config.weights).flatMap((w) => Object.keys(w)))];
  return (
    <Panel title="Engine" description={`Reference catalog ${config.reference_competitor} · engine ${config.engine_version}`} className="mt-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Thresholds (score 0-100)</p>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(config.thresholds).map(([key, value]) => (
              <div key={key} className="rounded-lg bg-muted/50 px-3 py-2">
                <dt className="truncate text-xs text-muted-foreground" title={labelize(key)}>
                  {labelize(key)}
                </dt>
                <dd className="text-lg font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Weights per product profile</p>
          <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-3">Profile</TableHead>
                  {signals.map((signal) => (
                    <TableHead key={signal} className="text-right">
                      {labelize(signal)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(config.weights).map(([profile, weights]) => (
                  <TableRow key={profile}>
                    <TableCell className="pl-3 font-medium">{labelize(profile)}</TableCell>
                    {signals.map((signal) => (
                      <TableCell key={signal} className="text-right tabular-nums">
                        {weights[signal] ?? "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </Panel>
  );
}
