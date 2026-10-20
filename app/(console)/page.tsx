import Link from "next/link";
import { ApiUnavailable, Badge, Card, EmptyState, PageHeader, ProgressBar, StatCard, StatusBadge } from "@/components/ui";
import { apiFetch, settle } from "@/lib/api";
import { formatDateTime, formatNumber, formatRelative, labelize } from "@/lib/format";
import type { Competitor, Health, Job, Notification, Paginated, Stats } from "@/lib/types";

export default async function OverviewPage() {
  const [health, stats, competitors, jobs, notifications] = await Promise.all([
    settle(apiFetch<Health>("/health")),
    settle(apiFetch<Stats>("/stats")),
    settle(apiFetch<Competitor[]>("/competitors")),
    settle(apiFetch<Paginated<Job>>("/jobs", { query: { limit: 5 } })),
    settle(apiFetch<Paginated<Notification>>("/notifications", { query: { unread: true, limit: 5 } })),
  ]);

  const apiOk = health.data?.status === "ok";

  return (
    <>
      <PageHeader
        title="Overview"
        description="Live state of the scraper: catalog coverage, running jobs and anything that needs attention."
        actions={
          health.data ? (
            <Badge tone={apiOk ? "success" : "warning"}>
              API {health.data.status} · v{health.data.version}
            </Badge>
          ) : (
            <Badge tone="danger">API unreachable</Badge>
          )
        }
      />

      {stats.error ? <ApiUnavailable message={stats.error} /> : null}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Competitors" value={formatNumber(stats.data?.competitors)} href="/competitors" />
        <StatCard label="Categories" value={formatNumber(stats.data?.categories)} href="/categories" />
        <StatCard
          label="Active products"
          value={formatNumber(stats.data?.products_active)}
          hint={`${formatNumber(stats.data?.products_missing)} missing`}
          href="/products"
        />
        <StatCard label="Price observations" value={formatNumber(stats.data?.observations)} />
        <StatCard
          label="Active jobs"
          value={formatNumber(stats.data?.active_jobs)}
          tone={stats.data?.active_jobs ? "success" : "default"}
          href="/jobs"
        />
        <StatCard label="Scrape runs" value={formatNumber(stats.data?.runs)} href="/runs" />
        <StatCard
          label="Unread notifications"
          value={formatNumber(stats.data?.unread_notifications)}
          tone={stats.data?.unread_notifications ? "warning" : "default"}
          href="/notifications"
        />
        <StatCard
          label="Worker"
          value={health.data?.worker.online ? "Online" : "Offline"}
          hint={health.data?.worker.auto_schedule ? "Auto-schedule on" : "Manual scheduling"}
        />
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card
            title="Competitors"
            description="Catalog coverage and worker state per competitor"
            padded={false}
            actions={
              <Link href="/competitors" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                View all →
              </Link>
            }
          >
            {competitors.error ? (
              <div className="p-5">
                <ApiUnavailable message={competitors.error} />
              </div>
            ) : competitors.data && competitors.data.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {competitors.data.map((c) => (
                  <li key={c.key}>
                    <Link href={`/competitors/${c.key}`} className="flex flex-col gap-3 px-5 py-4 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{c.name}</p>
                        <p className="truncate text-xs text-slate-500">{c.base_url}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                        <span className="tabular-nums">{formatNumber(c.stats.products_active)} products</span>
                        <span className="tabular-nums">{formatNumber(c.stats.categories)} categories</span>
                        <StatusBadge status={c.worker.state} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No competitors yet" />
            )}
          </Card>

          <Card
            title="Latest jobs"
            description="Most recent catalog syncs and price refreshes"
            padded={false}
            actions={
              <Link href="/jobs" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                All jobs →
              </Link>
            }
          >
            {jobs.error ? (
              <div className="p-5">
                <ApiUnavailable message={jobs.error} />
              </div>
            ) : jobs.data && jobs.data.items.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {jobs.data.items.map((job) => (
                  <li key={job.id}>
                    <Link href={`/jobs/${job.id}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          #{job.id} · {labelize(job.task)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {job.competitor_key} · {formatDateTime(job.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {job.status === "running" || job.status === "paused" ? (
                          <div className="w-28">
                            <ProgressBar value={job.progress.percent} />
                          </div>
                        ) : null}
                        <StatusBadge status={job.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No jobs have run yet" />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card
            title="Needs attention"
            description="Unread notifications"
            padded={false}
            actions={
              <Link href="/notifications" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                Inbox →
              </Link>
            }
          >
            {notifications.error ? (
              <div className="p-5">
                <ApiUnavailable message={notifications.error} />
              </div>
            ) : notifications.data && notifications.data.items.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {notifications.data.items.map((n) => (
                  <li key={n.id} className="px-5 py-3.5">
                    <div className="flex items-start gap-2">
                      <StatusBadge status={n.level} label={labelize(n.level)} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{n.title}</p>
                        {n.message ? <p className="line-clamp-2 text-xs text-slate-500">{n.message}</p> : null}
                        <p className="mt-1 text-xs text-slate-400">{formatRelative(n.created_at)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="All caught up">No unread notifications.</EmptyState>
            )}
          </Card>

          <Card title="Service health">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Database</dt>
                <dd>{health.data ? <StatusBadge status={health.data.database ? "success" : "failed"} label={health.data.database ? "Connected" : "Down"} /> : "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Worker heartbeat</dt>
                <dd className="text-slate-900">{formatRelative(health.data?.worker.heartbeat_at)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Worker instance</dt>
                <dd className="truncate font-mono text-xs text-slate-600">{health.data?.worker.instance ?? "—"}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
