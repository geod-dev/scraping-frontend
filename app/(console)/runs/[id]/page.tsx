import Link from "next/link";
import { notFound } from "next/navigation";
import { retryFailedRun } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { ApiUnavailable, Badge, Card, DefinitionList, EmptyState, Field, FilterBar, PageHeader, Pagination, StatCard, StatusBadge, Table, Td, Th, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { apiFetch, isApiError, settle } from "@/lib/api";
import { formatDateTime, formatDuration, formatNumber, labelize } from "@/lib/format";
import { buildQuery, oneOf, positiveInt, type SearchParams } from "@/lib/params";
import type { Paginated, RunDetail, RunItem } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Run ${id}` };
}

const PAGE_SIZE = 50;

export default async function RunDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const runId = Number(id);
  if (!Number.isInteger(runId) || runId <= 0) notFound();

  const itemStatus = oneOf(sp.status, ["succeeded", "failed", "not_found", "no_price", "skipped"] as const);
  const itemType = oneOf(sp.item_type, ["listing_page", "product"] as const);
  const offset = positiveInt(sp.offset, 0);

  let run: RunDetail;
  try {
    run = await apiFetch<RunDetail>(`/runs/${runId}`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    return (
      <>
        <PageHeader title="Run" />
        <ApiUnavailable message={isApiError(error) ? error.message : "Unexpected error."} />
      </>
    );
  }

  const items = await settle(
    apiFetch<Paginated<RunItem>>(`/runs/${runId}/items`, {
      query: { status: itemStatus, item_type: itemType, limit: PAGE_SIZE, offset },
    }),
  );

  const failedItems = Object.values(run.item_counts ?? {}).reduce((sum, byStatus) => sum + (byStatus.failed ?? 0), 0);
  const hasFailures = run.pages_failed > 0 || run.products_failed > 0 || failedItems > 0;
  const retryScope = run.operation === "catalog_discovery" ? "failed product and category pages" : "failed products";

  const duration = run.finished_at ? (new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000 : null;
  const paging = { status: itemStatus, item_type: itemType };

  return (
    <>
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/runs" className="hover:text-slate-900">
          Runs
        </Link>
        <span> / #{run.id}</span>
      </nav>

      <PageHeader
        title={`Run #${run.id} · ${labelize(run.operation)}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={run.status} />
            <span>Started {formatDateTime(run.started_at)}</span>
            {run.full_scope ? <Badge tone="violet">Full scope</Badge> : null}
          </span>
        }
        actions={
          hasFailures && run.status !== "running" ? (
            <ActionButton
              action={retryFailedRun}
              input={{ id: run.id }}
              label="Retry failed pages"
              pendingLabel="Starting…"
              variant="primary"
              title={`Queue a job that only refetches the ${retryScope} of this run`}
              confirmMessage={`Queue a job that only refetches the ${retryScope} of this run? This will use scraping credits.`}
              followResult
            />
          ) : null
        }
      />

      {run.error ? (
        <div className="mb-6">
          <ApiUnavailable message={run.error} />
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Products seen" value={formatNumber(run.products_seen)} hint={`${formatNumber(run.products_created)} created · ${formatNumber(run.products_updated)} updated`} />
        <StatCard label="Observations" value={formatNumber(run.observations_created)} hint={`${formatNumber(run.products_without_price)} without price`} />
        <StatCard label="Pages" value={formatNumber(run.pages_fetched)} hint={`${formatNumber(run.pages_failed)} failed`} tone={run.pages_failed ? "warning" : "default"} />
        <StatCard label="Credits used" value={formatNumber(run.credits_used)} hint={formatDuration(duration)} />
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Items" description="Per-page and per-product results for this run" padded={false}>
            <div className="p-5 pb-0">
              <FilterBar>
                <Field label="Status">
                  <select className={inputClass} name="status" defaultValue={itemStatus ?? ""}>
                    <option value="">Any</option>
                    {["succeeded", "failed", "not_found", "no_price", "skipped"].map((s) => (
                      <option key={s} value={s}>
                        {labelize(s)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Type">
                  <select className={inputClass} name="item_type" defaultValue={itemType ?? ""}>
                    <option value="">Any</option>
                    <option value="listing_page">Listing page</option>
                    <option value="product">Product</option>
                  </select>
                </Field>
                <div className="flex gap-2">
                  <button type="submit" className={primaryButton}>
                    Apply
                  </button>
                  <Link href={`/runs/${run.id}`} className={secondaryButton}>
                    Reset
                  </Link>
                </div>
              </FilterBar>
            </div>

            {items.error ? (
              <div className="p-5">
                <ApiUnavailable message={items.error} />
              </div>
            ) : items.data && items.data.items.length > 0 ? (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>Type</Th>
                      <Th>URL</Th>
                      <Th>Status</Th>
                      <Th>Details</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.data.items.map((item) => (
                      <tr key={item.id} className="align-top hover:bg-slate-50">
                        <Td>
                          <span className="whitespace-nowrap text-xs text-slate-600">{labelize(item.item_type)}</span>
                        </Td>
                        <Td className="max-w-xs">
                          <a href={item.url} target="_blank" rel="noreferrer" className="break-all text-xs text-indigo-600 hover:text-indigo-500">
                            {item.url}
                          </a>
                          {item.product_id ? (
                            <div>
                              <Link href={`/products/${item.product_id}`} className="text-xs text-slate-500 hover:text-slate-900">
                                Product #{item.product_id}
                              </Link>
                            </div>
                          ) : null}
                        </Td>
                        <Td>
                          <StatusBadge status={item.status} />
                          {item.http_status ? <div className="mt-1 text-xs text-slate-500">HTTP {item.http_status}</div> : null}
                        </Td>
                        <Td className="max-w-sm">
                          {item.error_type || item.error_message ? (
                            <div className="text-xs">
                              {item.error_type ? <span className="font-medium text-rose-700">{item.error_type}</span> : null}
                              {item.error_message ? <p className="mt-0.5 line-clamp-3 text-slate-600">{item.error_message}</p> : null}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <div className="p-5 pt-0">
                  <Pagination
                    basePath={`/runs/${run.id}`}
                    query={paging}
                    total={items.data.total}
                    limit={items.data.limit}
                    offset={items.data.offset}
                  />
                </div>
              </>
            ) : (
              <div className="p-5">
                <EmptyState title="No items match these filters" />
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Summary">
            <DefinitionList
              items={[
                { label: "Operation", value: labelize(run.operation) },
                { label: "Finished", value: formatDateTime(run.finished_at) },
                { label: "Duration", value: formatDuration(duration) },
                { label: "Categories seen", value: formatNumber(run.categories_seen) },
                { label: "Products failed", value: formatNumber(run.products_failed) },
                { label: "Categories marked missing", value: formatNumber(run.categories_marked_missing) },
                { label: "Products marked missing", value: formatNumber(run.products_marked_missing) },
              ]}
            />
          </Card>

          <Card title="Item counts">
            {Object.keys(run.item_counts ?? {}).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(run.item_counts).map(([itemType, byStatus]) => (
                  <div key={itemType}>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">{labelize(itemType)}</p>
                    <ul className="space-y-1.5 text-sm">
                      {Object.entries(byStatus).map(([status, count]) => (
                        <li key={status} className="flex items-center justify-between">
                          <Link
                            href={`/runs/${run.id}?${buildQuery({ status, item_type: itemType })}`}
                            className="text-slate-600 hover:text-indigo-600"
                          >
                            {labelize(status)}
                          </Link>
                          <span className="font-medium tabular-nums text-slate-900">{formatNumber(count)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No item counts recorded.</p>
            )}
          </Card>

          <Card title="Parameters">
            <pre className="max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(run.params ?? {}, null, 2)}</pre>
          </Card>
        </div>
      </div>
    </>
  );
}
