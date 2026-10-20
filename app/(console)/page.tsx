import Link from "next/link";
import { CircleAlertIcon, CircleCheckIcon, TriangleAlertIcon } from "lucide-react";
import { ActivityChart } from "@/components/activity-chart";
import { ApiUnavailable, EmptyState, PageHeader, Panel, PanelLink, ProgressBar, RowChevron, StatCard, StatusBadge, ToneBadge } from "@/components/kit";
import { LinkRow } from "@/components/link-row";
import { LiveRefresh } from "@/components/live";
import { LiveJobBar } from "@/components/live-job";
import { StatusDistribution } from "@/components/matching";
import { NotificationLinks } from "@/components/notification-links";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch, settle } from "@/lib/api";
import { ageInDays, formatNumber, formatRelative, labelize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Competitor, Health, Job, JobStatus, MatchingSummary, Notification, OverviewStats, Paginated, PricePosition, Stats } from "@/lib/types";

const DAYS = 30;
// Older than this, a catalog or a price refresh is flagged as stale.
const CATALOG_STALE_DAYS = 7;
const PRICES_STALE_DAYS = 2;

export default async function OverviewPage() {
  const [health, stats, overview, competitors, active, notifications, matching] = await Promise.all([
    settle(apiFetch<Health>("/health")),
    settle(apiFetch<Stats>("/stats")),
    settle(apiFetch<OverviewStats>("/stats/overview", { query: { days: DAYS } })),
    settle(apiFetch<Competitor[]>("/competitors")),
    settle(apiFetch<Paginated<Job>>("/jobs", { query: { active: true, limit: 12 } })),
    settle(apiFetch<Paginated<Notification>>("/notifications", { query: { unread: true, limit: 5 } })),
    settle(apiFetch<MatchingSummary[]>("/matching/summary")),
  ]);

  const apiOk = health.data?.status === "ok";
  const competitorKeys = new Map(competitors.data?.map((c) => [c.id, c.key]));
  const competitorNames = new Map(competitors.data?.map((c) => [c.key, c.name]));
  const summaries = new Map(matching.data?.map((s) => [s.competitor_key, s]));
  const activeJobs = active.data?.items ?? [];

  // Matching coverage across competitors.
  const toReview = matching.data?.reduce((sum, s) => sum + s.needs_review, 0) ?? 0;
  const obsolete = matching.data?.reduce((sum, s) => sum + s.deprecated, 0) ?? 0;
  const eligible = matching.data?.reduce((sum, s) => sum + s.eligible_products, 0) ?? 0;
  const counts: Record<string, number> = {};
  for (const s of matching.data ?? []) for (const [status, n] of Object.entries(s.counts)) counts[status] = (counts[status] ?? 0) + n;
  const associated = (counts.auto_matched ?? 0) + (counts.validated ?? 0);

  const totals = overview.data?.totals;
  const jobOutcomes = totals?.jobs ?? {};
  const finished = Object.values(jobOutcomes).reduce((sum, n) => sum + (n ?? 0), 0);
  const succeeded = jobOutcomes.succeeded ?? 0;
  const troubled = (jobOutcomes.failed ?? 0) + (jobOutcomes.interrupted ?? 0);
  const credits = overview.data?.credits;
  const creditsLow = credits?.monthly_limit && credits.monthly_remaining !== null ? credits.monthly_remaining / credits.monthly_limit < 0.1 : false;

  const attention = [
    toReview > 0 && { tone: "warning" as const, text: `${formatNumber(toReview)} matches wait for a review`, href: "/matching/review", action: "Review" },
    obsolete > 0 && { tone: "warning" as const, text: `${formatNumber(obsolete)} matches became obsolete`, href: "/matching/deprecated", action: "See obsolete" },
    troubled > 0 && { tone: "danger" as const, text: `${troubled} jobs failed or were interrupted in the last ${DAYS} days`, href: "/jobs?status=failed", action: "Jobs" },
    health.data && !health.data.worker.online && { tone: "danger" as const, text: "The worker is offline: no job can run", href: "/jobs", action: "Jobs" },
    !health.data && { tone: "danger" as const, text: "The scraper API is unreachable", href: "/", action: "Retry" },
    creditsLow && { tone: "danger" as const, text: `Only ${formatNumber(credits?.monthly_remaining)} Scrape.do credits left this month`, href: "/runs", action: "Runs" },
  ].filter((item): item is Exclude<typeof item, false | null | undefined> => Boolean(item));

  return (
    <>
      <LiveRefresh on={["job.status", "matching.updated", "notification.created", "competitor.updated"]} />
      <PageHeader
        title="Overview"
        description={`Catalog coverage, matching progress, scraping budget and activity of the last ${DAYS} days.`}
        actions={
          health.data ? (
            <ToneBadge tone={apiOk ? "success" : "warning"}>
              API {health.data.status} · v{health.data.version}
            </ToneBadge>
          ) : (
            <ToneBadge tone="danger">API unreachable</ToneBadge>
          )
        }
      />

      {stats.error ? (
        <div className="mb-6">
          <ApiUnavailable message={stats.error} />
        </div>
      ) : null}

      <section className="mb-6">
        {attention.length > 0 ? (
          <ul className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">
            {attention.map((item) => (
              <li key={item.text}>
                <Link href={item.href} className="flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-muted/60">
                  {item.tone === "danger" ? <CircleAlertIcon className="size-4 shrink-0 text-rose-600" /> : <TriangleAlertIcon className="size-4 shrink-0 text-amber-600" />}
                  <span className="flex-1 font-medium">{item.text}</span>
                  <span className="text-xs font-medium text-primary">{item.action} →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
            <CircleCheckIcon className="size-4" /> Nothing needs attention: no review pending, no failed job, the worker is online.
          </p>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active products"
          value={formatNumber(stats.data?.products_active)}
          href="/products"
          hint={`${formatNumber(totals?.products_created)} new in ${DAYS} days · ${formatNumber(stats.data?.products_missing)} missing · ${formatNumber(stats.data?.categories)} categories`}
        >
          {stats.data ? <ProgressBar size="sm" tone="emerald" value={(stats.data.products_active / Math.max(1, stats.data.products_active + stats.data.products_missing)) * 100} /> : null}
        </StatCard>
        <StatCard
          label="Matched with Antalis"
          value={formatNumber(associated)}
          href="/matching"
          tone={toReview > 0 ? "warning" : "default"}
          hint={eligible > 0 ? `${Math.round((associated / eligible) * 100)}% of ${formatNumber(eligible)} eligible products · ${formatNumber(toReview)} to review` : "No eligible product yet"}
        >
          <StatusDistribution counts={counts} compact />
        </StatCard>
        <StatCard
          label="Scrape.do credits left"
          value={credits?.monthly_remaining != null ? formatNumber(credits.monthly_remaining) : "—"}
          tone={creditsLow ? "danger" : "default"}
          hint={
            credits?.monthly_limit
              ? `${formatNumber(credits.monthly_limit - (credits.monthly_remaining ?? 0))} of ${formatNumber(credits.monthly_limit)} used${credits.renews_at ? ` · renews ${formatRelative(credits.renews_at)}` : ""}`
              : (overview.error ?? "Quota unavailable")
          }
        >
          {credits?.monthly_limit && credits.monthly_remaining != null ? (
            <ProgressBar size="sm" tone={creditsLow ? "rose" : "primary"} value={((credits.monthly_limit - credits.monthly_remaining) / credits.monthly_limit) * 100} />
          ) : null}
        </StatCard>
        <StatCard
          label="Job success rate"
          value={finished > 0 ? `${Math.round((succeeded / finished) * 100)}%` : "—"}
          href="/jobs"
          tone={troubled > 0 ? "warning" : "default"}
          hint={`${succeeded} of ${finished} jobs in ${DAYS} days · ${activeJobs.length} running now · worker ${health.data?.worker.online ? "online" : "offline"}`}
        >
          {finished > 0 ? <OutcomeBar outcomes={jobOutcomes} total={finished} /> : null}
        </StatCard>
      </section>

      {activeJobs.length > 0 ? (
        <Panel title="Running now" className="mt-6" actions={<PanelLink href="/jobs?active=1">Active jobs</PanelLink>}>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {activeJobs.map((job) => (
              <li key={job.id}>
                <Link href={`/jobs/${job.id}`} className="block rounded-lg border p-3 transition hover:border-primary/40 hover:bg-muted/40">
                  <LiveJobBar job={job} title={`${competitorNames.get(job.competitor_key) ?? job.competitor_key} · ${labelize(job.task)}`} />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Activity" description={`Per day, last ${DAYS} days`} className="xl:col-span-2">
          {overview.data ? <ActivityChart daily={overview.data.daily} /> : <ApiUnavailable message={overview.error ?? "No statistics."} />}
        </Panel>
        <Panel title="Price position vs Antalis" description="Associated products with a comparable price on both sides">
          {overview.data ? (
            overview.data.price_position.length > 0 ? (
              <PricePositions positions={overview.data.price_position} names={competitorNames} />
            ) : (
              <EmptyState title="No comparable pair yet">Prices are compared once products are matched with Antalis.</EmptyState>
            )
          ) : (
            <ApiUnavailable message={overview.error ?? "No statistics."} />
          )}
          {totals ? (
            <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
              In {DAYS} days: <span className="font-medium text-rose-700">{formatNumber(totals.price_increases)} price increases</span> ·{" "}
              <span className="font-medium text-emerald-700">{formatNumber(totals.price_decreases)} decreases</span> across all competitors.
            </p>
          ) : null}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Competitors" description="Catalog freshness, worker and matching per competitor" flush className="xl:col-span-2" actions={<PanelLink href="/competitors">All competitors</PanelLink>}>
          {competitors.error ? (
            <div className="p-4">
              <ApiUnavailable message={competitors.error} />
            </div>
          ) : competitors.data && competitors.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Competitor</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead>Catalog</TableHead>
                  <TableHead>Prices</TableHead>
                  <TableHead className="w-40">Matching</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitors.data.map((c) => {
                  const summary = summaries.get(c.key);
                  return (
                    <LinkRow key={c.key} href={`/competitors/${c.key}`}>
                      <TableCell className="pl-4">
                        <Link href={`/competitors/${c.key}`} className="font-medium hover:text-primary">
                          {c.name}
                        </Link>
                        <div className="mt-0.5">
                          <StatusBadge status={c.worker.state} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(c.stats.products_active)}
                        {c.stats.products_missing ? <div className="text-xs text-muted-foreground">{formatNumber(c.stats.products_missing)} missing</div> : null}
                      </TableCell>
                      <TableCell>
                        <Freshness value={c.last_full_catalog_at} staleDays={CATALOG_STALE_DAYS} />
                      </TableCell>
                      <TableCell>
                        <Freshness value={c.last_price_refresh_at} staleDays={PRICES_STALE_DAYS} />
                      </TableCell>
                      <TableCell>
                        {summary ? (
                          <div className="space-y-1">
                            <StatusDistribution counts={summary.counts} compact />
                            <p className="text-xs text-muted-foreground">
                              {summary.needs_review ? <span className="font-medium text-amber-700">{formatNumber(summary.needs_review)} to review</span> : "Up to date"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Reference</span>
                        )}
                      </TableCell>
                      <RowChevron />
                    </LinkRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="No competitors yet" />
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Unread notifications" flush actions={<PanelLink href="/notifications?unread=1">Inbox</PanelLink>}>
            {notifications.error ? (
              <div className="p-4">
                <ApiUnavailable message={notifications.error} />
              </div>
            ) : notifications.data && notifications.data.items.length > 0 ? (
              <ul className="divide-y">
                {notifications.data.items.map((n) => (
                  <li key={n.id} className="flex gap-2.5 px-4 py-3">
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", LEVEL_DOTS[n.level])} aria-label={labelize(n.level)} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{n.title}</p>
                      {n.message ? <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p> : null}
                      <p className="mt-1 text-xs text-muted-foreground">{formatRelative(n.created_at)}</p>
                      <NotificationLinks notification={n} competitorKey={competitorKeys.get(n.competitor_id ?? -1)} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="All caught up">No unread notifications.</EmptyState>
            )}
          </Panel>

          <Panel title="Service health">
            <dl className="space-y-3 text-sm">
              <HealthRow label="Database">
                {health.data ? <StatusBadge status={health.data.database ? "success" : "failed"} label={health.data.database ? "Connected" : "Down"} /> : "—"}
              </HealthRow>
              <HealthRow label="Worker">
                {health.data ? <StatusBadge status={health.data.worker.online ? "success" : "failed"} label={health.data.worker.online ? "Online" : "Offline"} /> : "—"}
              </HealthRow>
              <HealthRow label="Heartbeat">{formatRelative(health.data?.worker.heartbeat_at)}</HealthRow>
              <HealthRow label="Scheduling">{health.data?.worker.auto_schedule ? "Automatic" : "Manual"}</HealthRow>
              <HealthRow label="Instance">
                <span className="truncate font-mono text-xs text-muted-foreground">{health.data?.worker.instance ?? "—"}</span>
              </HealthRow>
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}

const LEVEL_DOTS: Record<string, string> = { info: "bg-sky-500", success: "bg-emerald-500", warning: "bg-amber-500", error: "bg-rose-500" };

const OUTCOME_COLORS: Partial<Record<JobStatus, string>> = {
  succeeded: "bg-emerald-500",
  partial: "bg-amber-400",
  failed: "bg-rose-500",
  interrupted: "bg-orange-400",
  cancelled: "bg-slate-300",
};

function OutcomeBar({ outcomes, total }: { outcomes: Partial<Record<JobStatus, number>>; total: number }) {
  const entries = Object.entries(outcomes).filter(([, n]) => n) as [JobStatus, number][];
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted" title={entries.map(([s, n]) => `${labelize(s)}: ${n}`).join(" · ")}>
      {entries.map(([status, n]) => (
        <span key={status} className={OUTCOME_COLORS[status] ?? "bg-slate-300"} style={{ width: `${(n / total) * 100}%` }} />
      ))}
    </div>
  );
}

// Per competitor, the share of associated products cheaper / at par / pricier than Antalis.
function PricePositions({ positions, names }: { positions: PricePosition[]; names: Map<string, string> }) {
  return (
    <ul className="space-y-4">
      {positions.map((p) => {
        const total = Math.max(1, p.cheaper + p.same + p.pricier);
        return (
          <li key={p.competitor_key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium">{names.get(p.competitor_key) ?? p.competitor_key}</span>
              <span className={cn("shrink-0 text-xs font-semibold tabular-nums", (p.median_gap_percent ?? 0) < 0 ? "text-emerald-700" : "text-rose-700")} title="Median price gap with Antalis">
                {p.median_gap_percent === null ? "—" : `${p.median_gap_percent > 0 ? "+" : ""}${p.median_gap_percent.toFixed(1)}% median`}
              </span>
            </div>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className="bg-emerald-500" style={{ width: `${(p.cheaper / total) * 100}%` }} />
              <span className="bg-slate-300" style={{ width: `${(p.same / total) * 100}%` }} />
              <span className="bg-rose-400" style={{ width: `${(p.pricier / total) * 100}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(p.cheaper)} cheaper · {formatNumber(p.same)} at par · {formatNumber(p.pricier)} pricier · {formatNumber(p.pairs)} pairs
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function Freshness({ value, staleDays }: { value: string | null; staleDays: number }) {
  const age = ageInDays(value);
  const stale = age === null || age > staleDays;
  return (
    <span className={cn("whitespace-nowrap text-sm", stale ? "font-medium text-amber-700" : "text-muted-foreground")} title={stale ? `Older than ${staleDays} days` : undefined}>
      {formatRelative(value)}
    </span>
  );
}

function HealthRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
