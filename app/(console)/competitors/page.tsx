import Link from "next/link";
import { isActiveJob } from "@/components/job-progress";
import { ApiUnavailable, EmptyState, PageHeader, StatusBadge, ToneBadge } from "@/components/kit";
import { LiveRefresh } from "@/components/live";
import { LiveJobBar } from "@/components/live-job";
import { StatusDistribution } from "@/components/matching";
import { Card } from "@/components/ui/card";
import { apiFetch, settle } from "@/lib/api";
import { formatNumber, formatRelative } from "@/lib/format";
import { jobCategoryNames } from "@/lib/job-categories";
import { jobTitle } from "@/lib/tasks";
import type { Competitor, MatchingSummary } from "@/lib/types";

export const metadata = { title: "Competitors" };

export default async function CompetitorsPage() {
  const [result, matching] = await Promise.all([settle(apiFetch<Competitor[]>("/competitors")), settle(apiFetch<MatchingSummary[]>("/matching/summary"))]);
  const summaries = new Map(matching.data?.map((s) => [s.competitor_key, s]));
  const categories = await jobCategoryNames(result.data?.map((c) => c.worker.job) ?? []);

  return (
    <>
      <LiveRefresh on={["job.status", "competitor.updated", "matching.updated"]} />
      <PageHeader title="Competitors" description="Each competitor has its own catalog, worker and price history." />

      {result.error ? <ApiUnavailable message={result.error} /> : null}

      {result.data ? (
        result.data.length === 0 ? (
          <EmptyState title="No competitors configured" />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.data.map((c) => {
              const job = c.worker.job && isActiveJob(c.worker.job) ? c.worker.job : null;
              const summary = summaries.get(c.key);
              return (
                <li key={c.key}>
                  <Link href={`/competitors/${c.key}`} className="group block h-full">
                    <Card className="h-full gap-4 px-5 transition group-hover:shadow-md group-hover:ring-primary/30">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold group-hover:text-primary">{c.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{c.base_url.replace(/^https?:\/\//, "")}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <StatusBadge status={c.worker.state} />
                          {c.enabled ? null : <ToneBadge tone="warning">Disabled</ToneBadge>}
                        </div>
                      </div>

                      {job ? (
                        <div className="rounded-lg bg-sky-50/70 p-3 ring-1 ring-sky-100">
                          <LiveJobBar job={job} title={jobTitle(job, categories)} />
                        </div>
                      ) : null}

                      <dl className="grid grid-cols-3 gap-3 text-sm">
                        <Figure label="Products" value={formatNumber(c.stats.products_active)} hint={c.stats.products_missing ? `${formatNumber(c.stats.products_missing)} missing` : undefined} />
                        <Figure label="Catalog sync" value={formatRelative(c.last_full_catalog_at)} />
                        <Figure label="Price refresh" value={formatRelative(c.last_price_refresh_at)} />
                      </dl>

                      {summary ? (
                        <div className="mt-auto space-y-1.5 border-t pt-3">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Matching</span>
                            {summary.needs_review ? <span className="font-medium text-amber-700">{formatNumber(summary.needs_review)} to review</span> : <span className="text-muted-foreground">Up to date</span>}
                          </div>
                          <StatusDistribution counts={summary.counts} compact />
                        </div>
                      ) : (
                        <p className="mt-auto border-t pt-3 text-xs text-muted-foreground">Reference catalog for matching</p>
                      )}
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium tabular-nums">{value}</dd>
      {hint ? <dd className="text-xs text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}
