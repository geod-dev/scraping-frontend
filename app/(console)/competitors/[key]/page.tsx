import Link from "next/link";
import { notFound } from "next/navigation";
import { DatabaseZapIcon, ExternalLinkIcon, GitCompareArrowsIcon, PauseIcon, PlayIcon, RotateCcwIcon, SquareIcon, TagIcon, type LucideIcon } from "lucide-react";
import { restartJob, workerControl } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { EstimateLine, isActiveJob, isRestartableJob, JobCategory, JobOrigin } from "@/components/job-progress";
import { ApiUnavailable, DefinitionList, PageHeader, Panel, PanelLink, StatCard, StatusBadge, ToneBadge } from "@/components/kit";
import { LiveRefresh } from "@/components/live";
import { LiveJobProgress } from "@/components/live-job";
import { StatusDistribution } from "@/components/matching";
import { StartTaskButton } from "@/components/task-dialog";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiFetch, isApiError, settle } from "@/lib/api";
import { formatDateTime, formatDuration, formatNumber, formatRelative, labelize } from "@/lib/format";
import { jobCategoryNames } from "@/lib/job-categories";
import { TASK_UNAVAILABLE_LABELS } from "@/lib/matching";
import { buildQuery } from "@/lib/params";
import type { CompetitorDetail, MatchingSummary, TaskName } from "@/lib/types";

const TASKS: { task: TaskName; label: string; description: string; icon: LucideIcon }[] = [
  { task: "catalog_sync", label: "Sync catalog", description: "Discover categories and products across the site.", icon: DatabaseZapIcon },
  { task: "price_refresh", label: "Refresh prices", description: "Re-read prices and details of the products already in the catalog, from their product pages.", icon: TagIcon },
  { task: "matching", label: "Match with Antalis", description: "Associate each product with its Antalis equivalent. No web page is fetched.", icon: GitCompareArrowsIcon },
];

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return { title: key };
}

export default async function CompetitorDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;

  let competitor: CompetitorDetail;
  try {
    competitor = await apiFetch<CompetitorDetail>(`/competitors/${encodeURIComponent(key)}`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    return (
      <>
        <PageHeader title="Competitor" breadcrumbs={[{ label: "Competitors", href: "/competitors" }]} />
        <ApiUnavailable message={isApiError(error) ? error.message : "Unexpected error."} />
      </>
    );
  }

  const { worker } = competitor;
  const job = worker.job && isActiveJob(worker.job) ? worker.job : null;
  const lastJob = worker.last_job;
  const state = worker.state;
  // The reference catalog itself is never matched.
  const isReference = worker.tasks?.matching?.reason === "matching_reference";
  const tasks = TASKS.filter((t) => !(t.task === "matching" && isReference));
  const [matching, categories] = await Promise.all([
    isReference ? null : settle(apiFetch<MatchingSummary[]>("/matching/summary", { query: { competitor: competitor.key } })),
    jobCategoryNames([job, lastJob]),
  ]);
  const summary = matching?.data?.[0] ?? null;
  const firstMatchingRun = summary ? summary.eligible_products > 0 && summary.never_matched >= summary.eligible_products : undefined;

  return (
    <>
      <LiveRefresh on={["job.status", "competitor.updated", "matching.updated"]} competitor={competitor.key} />
      <PageHeader
        breadcrumbs={[{ label: "Competitors", href: "/competitors" }, { label: competitor.name }]}
        title={competitor.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <a href={competitor.base_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:text-primary/80">
              {competitor.base_url.replace(/^https?:\/\//, "")}
              <ExternalLinkIcon className="size-3.5" />
            </a>
            <code className="text-xs">{competitor.key}</code>
            {competitor.enabled ? null : <ToneBadge tone="warning">Disabled</ToneBadge>}
          </span>
        }
        actions={
          <>
            <StatusBadge status={state} label={`Worker ${labelize(state).toLowerCase()}`} />
            {state === "running" || state === "queued" ? (
              <ActionButton action={workerControl} input={{ key: competitor.key, action: "pause" }} label="Pause" icon={<PauseIcon />} />
            ) : null}
            {state === "paused" ? <ActionButton action={workerControl} input={{ key: competitor.key, action: "resume" }} label="Resume" icon={<PlayIcon />} variant="default" /> : null}
            {state !== "idle" ? (
              <ActionButton
                action={workerControl}
                input={{ key: competitor.key, action: "stop" }}
                label="Stop"
                icon={<SquareIcon />}
                variant="destructive"
                confirmTitle="Stop the active job of this competitor?"
                confirmMessage="Progress already saved is kept; the job can be restarted later."
                confirmLabel="Stop"
              />
            ) : null}
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Active products"
          value={formatNumber(competitor.stats.products_active)}
          hint={`${formatNumber(competitor.stats.products_missing)} missing`}
          href={`/products?competitor=${competitor.key}`}
        />
        <StatCard
          label="Categories"
          value={formatNumber(competitor.stats.categories)}
          hint={competitor.stats.banned_categories ? `${formatNumber(competitor.stats.banned_categories)} banned` : undefined}
          href={`/categories?competitor=${competitor.key}`}
        />
        <StatCard label="Price observations" value={formatNumber(competitor.stats.observations)} />
        <StatCard label="Last price seen" value={formatRelative(competitor.stats.last_price_observed_at)} />
      </section>

      {job ? (
        <Panel
          className="mt-6 ring-sky-200"
          title={`${labelize(job.task)} in progress`}
          description={
            <span className="inline-flex flex-wrap items-center gap-2">
              Job #{job.id} · started by {job.requested_by}
              <JobCategory job={job} names={categories} />
              <JobOrigin job={job} />
            </span>
          }
          actions={<PanelLink href={`/jobs/${job.id}`}>Open job</PanelLink>}
        >
          <LiveJobProgress job={job} />
        </Panel>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {summary ? (
            <Panel
              title="Matching"
              description={`${formatNumber(summary.eligible_products)} eligible products · last computed ${formatRelative(summary.last_computed_at)}`}
              actions={
                summary.needs_review > 0 ? (
                  <Link href={`/matching/review?competitor=${competitor.key}`} className={buttonVariants({ size: "lg" })}>
                    Review {formatNumber(summary.needs_review)} →
                  </Link>
                ) : (
                  <PanelLink href={`/matching/matches?competitor=${competitor.key}`}>All matches</PanelLink>
                )
              }
            >
              <StatusDistribution counts={summary.counts} hrefFor={(status) => `/matching/matches?${buildQuery({ competitor: competitor.key, status })}`} />
              {summary.never_matched > 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">{formatNumber(summary.never_matched)} products have never been matched: the next run scores them.</p>
              ) : null}
            </Panel>
          ) : null}

          {lastJob ? (
            <Panel
              title="Last job"
              description={
                <span className="inline-flex flex-wrap items-center gap-2">
                  #{lastJob.id} · {labelize(lastJob.task)} · requested by {lastJob.requested_by}
                  <JobCategory job={lastJob} names={categories} />
                  <JobOrigin job={lastJob} />
                </span>
              }
              actions={
                <div className="flex items-center gap-2">
                  {isRestartableJob(lastJob) ? (
                    <ActionButton
                      action={restartJob}
                      input={{ id: lastJob.id }}
                      label="Restart"
                      icon={<RotateCcwIcon />}
                      pendingLabel="Restarting…"
                      variant="default"
                      disabled={state !== "idle"}
                      title={state !== "idle" ? "The worker is busy" : "Continue this job, skipping the work already done"}
                      confirmTitle={`Restart job #${lastJob.id}?`}
                      confirmMessage="A new job continues it and skips the work already done."
                      confirmLabel="Restart"
                      followResult
                    />
                  ) : null}
                  <PanelLink href={`/jobs/${lastJob.id}`}>Open</PanelLink>
                </div>
              }
            >
              <DefinitionList
                columns={4}
                items={[
                  { label: "Status", value: <StatusBadge status={lastJob.status} /> },
                  { label: "Finished", value: lastJob.finished_at ? `${formatRelative(lastJob.finished_at)}` : "—" },
                  { label: "Duration", value: formatDuration(lastJob.duration_seconds) },
                  { label: "Created", value: formatDateTime(lastJob.created_at) },
                ]}
              />
              {lastJob.error ? <p className="mt-4 line-clamp-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800">{lastJob.error}</p> : null}
            </Panel>
          ) : null}

          {/* One horizontal card per task: what it does and costs on the left, its options and start button on the right. */}
          <section className="space-y-3" aria-label="Tasks">
            {tasks.map(({ task, label, description, icon: Icon }) => {
              const availability = worker.tasks?.[task];
              const allowed = availability ? availability.allowed : true;
              const reason = availability?.reason ? (TASK_UNAVAILABLE_LABELS[availability.reason] ?? labelize(availability.reason)) : null;
              const estimate = competitor.estimates?.[task];
              return (
                <Card key={task} className="flex-col gap-4 px-5 md:flex-row md:items-center">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold">{label}</p>
                      <p className="text-sm text-muted-foreground">{description}</p>
                      {estimate ? <EstimateLine estimate={estimate} /> : null}
                      {!allowed && reason ? <p className="text-xs font-medium text-amber-700">Unavailable: {reason}</p> : null}
                      {task === "matching" && firstMatchingRun ? <p className="text-xs text-amber-700">The first run embeds the whole catalog and can take a few minutes.</p> : null}
                    </div>
                  </div>
                  <StartTaskButton
                    competitorKey={competitor.key}
                    competitorName={competitor.name}
                    task={task}
                    label={`${label}…`}
                    icon={<Icon />}
                    disabled={!allowed || state !== "idle"}
                    disabledReason={reason ?? (state !== "idle" ? "The worker is busy with another job" : null)}
                    firstMatchingRun={task === "matching" ? firstMatchingRun : undefined}
                  />
                </Card>
              );
            })}
            {isReference ? <p className="text-xs text-muted-foreground">This competitor is the reference catalog for matching: its products are not matched themselves.</p> : null}
          </section>
        </div>

        <div className="space-y-6">
          <Panel title="Sync status">
            <DefinitionList
              columns={1}
              items={[
                { label: "Last catalog sync", value: <span title={formatDateTime(competitor.last_full_catalog_at)}>{formatRelative(competitor.last_full_catalog_at)}</span> },
                { label: "Catalog status", value: competitor.last_full_catalog_status ? <StatusBadge status={competitor.last_full_catalog_status} /> : "—" },
                {
                  label: "Last full catalog run",
                  value: competitor.last_full_catalog_run_id ? (
                    <Link href={`/runs/${competitor.last_full_catalog_run_id}`} className="text-primary hover:text-primary/80">
                      Run #{competitor.last_full_catalog_run_id}
                    </Link>
                  ) : (
                    "—"
                  ),
                },
                { label: "Last price refresh", value: <span title={formatDateTime(competitor.last_price_refresh_at)}>{formatRelative(competitor.last_price_refresh_at)}</span> },
                { label: "Adapter", value: <code className="text-xs">{competitor.adapter}</code> },
              ]}
            />
            <div className="mt-4 flex flex-wrap gap-3 border-t pt-3 text-sm">
              <PanelLink href={`/jobs?competitor=${competitor.key}`}>Jobs</PanelLink>
              <PanelLink href={`/runs?competitor=${competitor.key}`}>Runs</PanelLink>
            </div>
          </Panel>

          <Collapsible className="rounded-xl bg-card ring-1 ring-foreground/10">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold">
              Configuration
              <span className="text-xs font-normal text-muted-foreground">Show</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(competitor.config ?? {}, null, 2)}</pre>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </>
  );
}
