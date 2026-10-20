import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLinkIcon, RotateCcwIcon } from "lucide-react";
import { retryFailedRun } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { FilterBar, FilterToggle } from "@/components/filters";
import { ApiUnavailable, DefinitionList, EmptyState, KeyValueList, Notice, PageHeader, Pagination, Panel, StatCard, StatusBadge, ToneBadge } from "@/components/kit";
import { LinkRow } from "@/components/link-row";
import { LiveRefresh } from "@/components/live";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch, isApiError, settle } from "@/lib/api";
import { formatDateTime, formatDuration, formatNumber, labelize } from "@/lib/format";
import { oneOf, positiveInt, type SearchParams } from "@/lib/params";
import type { Competitor, Paginated, RunDetail, RunItem } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Run ${id}` };
}

const PAGE_SIZE = 50;
const ITEM_STATUSES = ["succeeded", "failed", "not_found", "no_price", "skipped"] as const;
const ITEM_TYPES = ["listing_page", "product"] as const;

export default async function RunDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  const sp = await searchParams;
  const runId = Number(id);
  if (!Number.isInteger(runId) || runId <= 0) notFound();

  const itemStatus = oneOf(sp.status, ITEM_STATUSES);
  const itemType = oneOf(sp.item_type, ITEM_TYPES);
  const offset = positiveInt(sp.offset, 0);

  let run: RunDetail;
  try {
    run = await apiFetch<RunDetail>(`/runs/${runId}`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    return (
      <>
        <PageHeader title="Run" breadcrumbs={[{ label: "Runs", href: "/runs" }]} />
        <ApiUnavailable message={isApiError(error) ? error.message : "Unexpected error."} />
      </>
    );
  }

  const [items, competitors] = await Promise.all([
    settle(apiFetch<Paginated<RunItem>>(`/runs/${runId}/items`, { query: { status: itemStatus, item_type: itemType, limit: PAGE_SIZE, offset } })),
    settle(apiFetch<Competitor[]>("/competitors")),
  ]);
  const competitor = competitors.data?.find((c) => c.id === run.competitor_id);

  // Item counts per status, for the selected type (or all types).
  const itemCounts = run.item_counts ?? {};
  const countFor = (status: string) =>
    Object.entries(itemCounts)
      .filter(([type]) => !itemType || type === itemType)
      .reduce((sum, [, byStatus]) => sum + (byStatus[status] ?? 0), 0);
  const failedItems = Object.values(itemCounts).reduce((sum, byStatus) => sum + (byStatus.failed ?? 0), 0);
  const hasFailures = run.pages_failed > 0 || run.products_failed > 0 || failedItems > 0;
  const retryScope = run.operation === "catalog_discovery" ? "failed product and category pages" : "failed products";
  const duration = run.finished_at ? (new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000 : null;
  const paging = { status: itemStatus, item_type: itemType };

  return (
    <>
      {run.status === "running" ? <LiveRefresh on={["job.status"]} /> : null}
      <PageHeader
        breadcrumbs={[{ label: "Runs", href: competitor ? `/runs?competitor=${competitor.key}` : "/runs" }, { label: `#${run.id}` }]}
        title={`${labelize(run.operation)} · ${competitor?.name ?? `run #${run.id}`}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={run.status} />
            Run #{run.id} · started {formatDateTime(run.started_at)}
            {run.full_scope ? <ToneBadge tone="violet">Full scope</ToneBadge> : <ToneBadge>Partial scope</ToneBadge>}
          </span>
        }
        actions={
          hasFailures && run.status !== "running" ? (
            <ActionButton
              action={retryFailedRun}
              input={{ id: run.id }}
              label="Retry failed pages"
              icon={<RotateCcwIcon />}
              pendingLabel="Starting…"
              variant="default"
              title={`Queue a job that only refetches the ${retryScope} of this run`}
              confirmTitle="Retry the failed pages?"
              confirmMessage={`A job refetches only the ${retryScope} of this run. This uses scraping credits.`}
              confirmLabel="Retry"
              followResult
            />
          ) : null
        }
      />

      {run.error ? (
        <div className="mb-6">
          <Notice tone="danger" title="The run reported an error">
            {run.error}
          </Notice>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Products seen" value={formatNumber(run.products_seen)} hint={`${formatNumber(run.products_created)} created · ${formatNumber(run.products_updated)} updated`} />
        <StatCard label="Price observations" value={formatNumber(run.observations_created)} hint={`${formatNumber(run.products_without_price)} products without price`} />
        <StatCard label="Pages fetched" value={formatNumber(run.pages_fetched)} hint={`${formatNumber(run.pages_failed)} failed`} tone={run.pages_failed ? "warning" : "default"} />
        <StatCard label="Credits used" value={formatNumber(run.credits_used)} hint={`in ${formatDuration(duration)}`} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Items" description="Result of every page and product of the run" flush className="xl:col-span-2">
          <div className="border-b px-4 pb-4">
            <FilterBar>
              <FilterToggle name="status" label="Item status" anyLabel="All" options={ITEM_STATUSES.map((s) => ({ value: s, label: labelize(s), count: countFor(s) || null }))} />
              <FilterToggle name="item_type" label="Item type" anyLabel="All types" options={ITEM_TYPES.map((t) => ({ value: t, label: labelize(t) }))} />
            </FilterBar>
          </div>

          {items.error ? (
            <div className="p-4">
              <ApiUnavailable message={items.error} />
            </div>
          ) : items.data && items.data.items.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Page</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.data.items.map((item) => {
                    const cells = (
                      <>
                        <TableCell className="max-w-md pl-4 whitespace-normal">
                          <p className="text-xs text-muted-foreground">{labelize(item.item_type)}</p>
                          {item.product_id ? (
                            <Link href={`/products/${item.product_id}`} className="font-medium hover:text-primary">
                              Product #{item.product_id}
                            </Link>
                          ) : null}
                          <a href={item.url} target="_blank" rel="noreferrer" className="mt-0.5 flex items-start gap-1 text-xs break-all text-muted-foreground hover:text-primary">
                            {item.url}
                            <ExternalLinkIcon className="mt-0.5 size-3 shrink-0" />
                          </a>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={item.status} />
                          {item.http_status ? <div className="mt-1 text-xs text-muted-foreground">HTTP {item.http_status}</div> : null}
                        </TableCell>
                        <TableCell className="max-w-sm whitespace-normal">
                          {item.error_type || item.error_message ? (
                            <div className="text-xs">
                              {item.error_type ? <span className="font-medium text-rose-700">{item.error_type}</span> : null}
                              {item.error_message ? <p className="mt-0.5 line-clamp-3 text-muted-foreground">{item.error_message}</p> : null}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </>
                    );
                    return item.product_id ? (
                      <LinkRow key={item.id} href={`/products/${item.product_id}`} className="align-top">
                        {cells}
                      </LinkRow>
                    ) : (
                      <TableRow key={item.id} className="align-top">
                        {cells}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="px-4 pb-4">
                <Pagination basePath={`/runs/${run.id}`} query={paging} total={items.data.total} limit={items.data.limit} offset={items.data.offset} />
              </div>
            </>
          ) : (
            <EmptyState title="No items match these filters" />
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Summary">
            <DefinitionList
              columns={2}
              items={[
                { label: "Finished", value: formatDateTime(run.finished_at) },
                { label: "Duration", value: formatDuration(duration) },
                { label: "Categories seen", value: formatNumber(run.categories_seen) },
                { label: "Products failed", value: formatNumber(run.products_failed) },
                { label: "Categories now missing", value: formatNumber(run.categories_marked_missing) },
                { label: "Products now missing", value: formatNumber(run.products_marked_missing) },
              ]}
            />
          </Panel>

          <Panel title="Parameters">
            <KeyValueList data={run.params} empty="Default parameters." />
          </Panel>

          {Object.keys(run.stats ?? {}).length > 0 ? (
            <Panel title="Statistics">
              <KeyValueList data={run.stats} />
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
