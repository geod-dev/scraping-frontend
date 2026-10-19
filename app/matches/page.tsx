import Link from "next/link";
import { setMatchStatus } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { ApiUnavailable, Card, EmptyState, Field, FilterBar, PageHeader, Pagination, StatusBadge, Table, Td, Th, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { apiFetch, settle } from "@/lib/api";
import { formatDateTime, labelize } from "@/lib/format";
import { oneOf, positiveInt, type SearchParams } from "@/lib/params";
import type { MatchStatus, Paginated, ProductMatch } from "@/lib/types";

export const metadata = { title: "Matches" };

const PAGE_SIZE = 25;

export default async function MatchesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const status = oneOf(sp.status, ["proposed", "validated", "rejected"] as const);
  const productId = positiveInt(sp.product_id, 0) || undefined;
  const offset = positiveInt(sp.offset, 0);

  const matches = await settle(
    apiFetch<Paginated<ProductMatch>>("/product-matches", {
      query: { status, product_id: productId, limit: PAGE_SIZE, offset },
    }),
  );

  const paging = { status, product_id: productId ? String(productId) : undefined };

  return (
    <>
      <PageHeader
        title="Matches"
        description="Proposed links between products from different sources. Validate or reject each one."
      />

      <FilterBar>
        <Field label="Status">
          <select className={inputClass} name="status" defaultValue={status ?? ""}>
            <option value="">Any</option>
            <option value="proposed">Proposed</option>
            <option value="validated">Validated</option>
            <option value="rejected">Rejected</option>
          </select>
        </Field>
        <Field label="Product ID">
          <input className={`${inputClass} w-32`} name="product_id" type="number" min={1} defaultValue={productId ?? ""} />
        </Field>
        <div className="flex gap-2">
          <button type="submit" className={primaryButton}>
            Apply
          </button>
          <Link href="/matches" className={secondaryButton}>
            Reset
          </Link>
        </div>
      </FilterBar>

      {matches.error ? <ApiUnavailable message={matches.error} /> : null}

      {matches.data ? (
        matches.data.items.length === 0 ? (
          <EmptyState title="No matches found">Matches are proposed by the matching process and will show up here.</EmptyState>
        ) : (
          <>
            <Card padded={false}>
              <Table>
                <thead>
                  <tr>
                    <Th>Products</Th>
                    <Th>Type</Th>
                    <Th>Confidence</Th>
                    <Th>Status</Th>
                    <Th>Validated</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matches.data.items.map((m) => (
                    <tr key={m.id} className="align-top hover:bg-slate-50">
                      <Td>
                        <div className="flex flex-col gap-1 text-sm">
                          <Link href={`/products/${m.product_a_id}`} className="text-indigo-600 hover:text-indigo-500">
                            Product #{m.product_a_id}
                          </Link>
                          <Link href={`/products/${m.product_b_id}`} className="text-indigo-600 hover:text-indigo-500">
                            Product #{m.product_b_id}
                          </Link>
                        </div>
                      </Td>
                      <Td>
                        <span className="text-xs text-slate-600">{labelize(m.match_type)}</span>
                        {m.method ? <div className="text-xs text-slate-400">{m.method}</div> : null}
                      </Td>
                      <Td>
                        <span className="tabular-nums">{m.confidence ?? "—"}</span>
                      </Td>
                      <Td>
                        <StatusBadge status={m.status} />
                      </Td>
                      <Td>
                        {m.validated_at ? (
                          <div className="text-xs text-slate-600">
                            <div>{formatDateTime(m.validated_at)}</div>
                            {m.validated_by ? <div className="text-slate-400">by {m.validated_by}</div> : null}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          {m.status !== "validated" ? (
                            <ActionButton action={setMatchStatus} input={{ id: m.id, status: "validated" as MatchStatus }} label="Validate" variant="primary" className="h-8 px-3 text-xs" />
                          ) : null}
                          {m.status !== "rejected" ? (
                            <ActionButton action={setMatchStatus} input={{ id: m.id, status: "rejected" as MatchStatus }} label="Reject" variant="danger" className="h-8 px-3 text-xs" />
                          ) : null}
                          {m.status !== "proposed" ? (
                            <ActionButton action={setMatchStatus} input={{ id: m.id, status: "proposed" as MatchStatus }} label="Reset" variant="secondary" className="h-8 px-3 text-xs" />
                          ) : null}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
            <Pagination basePath="/matches" query={paging} total={matches.data.total} limit={matches.data.limit} offset={matches.data.offset} />
          </>
        )
      ) : null}
    </>
  );
}
