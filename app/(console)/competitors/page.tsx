import Link from "next/link";
import { ApiUnavailable, Badge, EmptyState, PageHeader, Table, Td, Th, StatusBadge } from "@/components/ui";
import { apiFetch, settle } from "@/lib/api";
import { formatNumber, formatRelative } from "@/lib/format";
import type { Competitor } from "@/lib/types";

export const metadata = { title: "Competitors" };

export default async function CompetitorsPage() {
  const result = await settle(apiFetch<Competitor[]>("/competitors"));

  return (
    <>
      <PageHeader title="Competitors" description="Each competitor has its own catalog, workers and price history." />

      {result.error ? <ApiUnavailable message={result.error} /> : null}

      {result.data ? (
        result.data.length === 0 ? (
          <EmptyState title="No competitors configured" />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <Table>
              <thead>
                <tr>
                  <Th>Competitor</Th>
                  <Th>Worker</Th>
                  <Th align="right">Categories</Th>
                  <Th align="right">Active products</Th>
                  <Th align="right">Missing</Th>
                  <Th align="right">Observations</Th>
                  <Th>Last catalog sync</Th>
                  <Th>Last price refresh</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.data.map((c) => (
                  <tr key={c.key} className="hover:bg-slate-50">
                    <Td>
                      <Link href={`/competitors/${c.key}`} className="font-medium text-indigo-600 hover:text-indigo-500">
                        {c.name}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                        <code>{c.key}</code>
                        {c.enabled ? null : <Badge tone="warning">Disabled</Badge>}
                      </div>
                    </Td>
                    <Td>
                      <StatusBadge status={c.worker.state} />
                    </Td>
                    <Td align="right">{formatNumber(c.stats.categories)}</Td>
                    <Td align="right">{formatNumber(c.stats.products_active)}</Td>
                    <Td align="right">{formatNumber(c.stats.products_missing)}</Td>
                    <Td align="right">{formatNumber(c.stats.observations)}</Td>
                    <Td>
                      <span className="text-slate-700">{formatRelative(c.last_full_catalog_at)}</span>
                    </Td>
                    <Td>
                      <span className="text-slate-700">{formatRelative(c.last_price_refresh_at)}</span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )
      ) : null}
    </>
  );
}
