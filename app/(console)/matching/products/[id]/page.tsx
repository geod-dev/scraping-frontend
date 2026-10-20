import Link from "next/link";
import { notFound } from "next/navigation";
import { CandidateCard } from "@/components/candidate-card";
import { DecisionPanel } from "@/components/decision-panel";
import { KeyboardNav } from "@/components/keyboard-nav";
import { DecisionReasons, MatchEventList, MatchStatusBadge, ProductCell, ScoreGauge } from "@/components/matching";
import { ApiUnavailable, Badge, Card, DefinitionList, EmptyState, Notice, PageHeader, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { apiFetch, isApiError, settle } from "@/lib/api";
import { formatDateTime, formatNumber, labelize } from "@/lib/format";
import { MATCH_LIST_PATHS, parseMatchFilters, reviewHref, type MatchListKind } from "@/lib/match-filters";
import { DEPRECATED_REASON_LABELS, MATCH_STATUS_DESCRIPTIONS, MATCH_STATUS_LABELS, formatMeasure, formatScore } from "@/lib/matching";
import { buildQuery, oneOf, positiveInt, text, type QueryValues, type SearchParams } from "@/lib/params";
import type { CompareResult, MatchDetail, MatchListItem, MatchingConfig, Paginated, ProductAnalysis, ProductListItem } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Review product ${id}` };
}

const LIST_LABELS: Record<MatchListKind, string> = { review: "Review queue", matches: "All matches", deprecated: "Obsolete" };

type Neighbour = { href: string; title: string | null } | null;

// Previous/next items of the list the review was opened from. Fetches the items around the
// remembered position; when the product left the list (just decided), the item now at that
// position is the next one.
async function findNeighbours(kind: MatchListKind, sp: SearchParams, productId: number, position: number) {
  const filters = parseMatchFilters(sp, kind);
  const start = Math.max(0, position - 1);
  const page = await settle(
    apiFetch<Paginated<MatchListItem>>(`/matching/${kind}`, { query: { ...filters.query, limit: 3, offset: start } }),
  );
  if (!page.data) return { filters, prev: null, next: null, total: null, index: null };
  const items = page.data.items;
  const link = (i: number): Neighbour =>
    items[i] ? { href: reviewHref(items[i].product.id, { kind, values: filters.values, position: start + i }), title: items[i].product.title } : null;
  const at = items.findIndex((m) => m.product.id === productId);
  if (at >= 0) return { filters, prev: link(at - 1), next: link(at + 1), total: page.data.total, index: start + at };
  const here = position - start;
  return { filters, prev: link(here - 1), next: link(here), total: page.data.total, index: null };
}

export default async function MatchReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) notFound();

  const from = oneOf(sp.from, ["review", "matches", "deprecated"] as const);
  const position = positiveInt(sp.pos, 0);
  const find = text(sp.find);
  const compareId = positiveInt(sp.compare, 0) || undefined;

  let match: MatchDetail;
  try {
    match = await apiFetch<MatchDetail>(`/matching/products/${productId}`);
  } catch (error) {
    if (isApiError(error) && error.code === "match_not_found") {
      return (
        <>
          <PageHeader title="Not matched yet" />
          <EmptyState title="This product has not been matched yet">
            It will be scored by the next matching run of its competitor.{" "}
            <Link href={`/products/${productId}`} className="text-indigo-600 hover:text-indigo-500">
              Open the product
            </Link>{" "}
            or go to the{" "}
            <Link href="/matching" className="text-indigo-600 hover:text-indigo-500">
              matching overview
            </Link>
            .
          </EmptyState>
        </>
      );
    }
    if (isApiError(error) && error.status === 404) notFound();
    return (
      <>
        <PageHeader title="Review" />
        <ApiUnavailable message={isApiError(error) ? error.message : "Unexpected error."} />
      </>
    );
  }

  const [nav, config] = await Promise.all([
    from ? findNeighbours(from, sp, productId, position) : Promise.resolve(null),
    settle(apiFetch<MatchingConfig>("/matching/config")),
  ]);
  const referenceKey = config.data?.reference_competitor ?? "antalis_fr";

  const [search, comparison] = await Promise.all([
    find
      ? settle(apiFetch<Paginated<ProductListItem>>("/products", { query: { competitor: referenceKey, q: find, status: "active", limit: 10 } }))
      : Promise.resolve(null),
    compareId ? settle(apiFetch<CompareResult>(`/matching/products/${productId}/compare/${compareId}`)) : Promise.resolve(null),
  ]);

  // Parameters that keep the list context when moving around on this screen.
  const context: QueryValues = from && nav ? { ...nav.filters.values, from, pos: String(nav.index ?? position) } : {};
  const here = (extra: QueryValues) => {
    const qs = buildQuery({ ...context, ...extra });
    return qs ? `/matching/products/${productId}?${qs}` : `/matching/products/${productId}`;
  };
  const backHref = from && nav ? `${MATCH_LIST_PATHS[from]}?${buildQuery(nav.filters.values)}` : "/matching/matches";

  const ranked = match.candidates.filter((c) => c.rank !== null);
  const excluded = match.candidates.filter((c) => c.rank === null);
  const proposal = match.antalis_product ?? match.proposed_antalis_product;
  const compared = comparison?.data?.candidate ?? null;

  return (
    <>
      <KeyboardNav prevHref={nav?.prev?.href ?? null} nextHref={nav?.next?.href ?? null} />

      <nav className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span>
          <Link href="/matching" className="hover:text-slate-900">
            Matching
          </Link>
          {" / "}
          <Link href={backHref} className="hover:text-slate-900">
            {from ? LIST_LABELS[from] : "All matches"}
          </Link>
          <span> / #{match.product.id}</span>
        </span>
        {nav ? (
          <span className="flex items-center gap-2">
            {nav.index !== null && nav.total !== null ? (
              <span className="text-xs tabular-nums">
                {formatNumber(nav.index + 1)} of {formatNumber(nav.total)}
              </span>
            ) : null}
            {nav.prev ? (
              <Link href={nav.prev.href} className={`${secondaryButton} h-8 px-3 text-xs`} title={nav.prev.title ?? undefined}>
                ← Previous
              </Link>
            ) : null}
            {nav.next ? (
              <Link href={nav.next.href} className={`${secondaryButton} h-8 px-3 text-xs`} title={nav.next.title ?? undefined}>
                Next →
              </Link>
            ) : null}
            <span className="hidden text-xs text-slate-400 md:inline">← → to navigate</span>
          </span>
        ) : null}
      </nav>

      <PageHeader
        title={match.product.title ?? "Untitled product"}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <MatchStatusBadge status={match.status} manualChoice={match.manual_choice} />
            <span>{match.competitor_key}</span>
            {match.product.catalog_reference ? <code className="text-xs">{match.product.catalog_reference}</code> : null}
            <Link href={`/products/${match.product.id}`} className="text-indigo-600 hover:text-indigo-500">
              Product page
            </Link>
            <a href={match.product.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-500">
              Competitor site ↗
            </a>
          </span>
        }
        actions={<ScoreGauge score={match.score} />}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Decision" description={MATCH_STATUS_DESCRIPTIONS[match.status]}>
            <div className="space-y-5">
              <StatusSummary match={match} />
              <DecisionPanel
                productId={match.product.id}
                proposalTitle={proposal ? (proposal.title ?? `Product #${proposal.id}`) : null}
                validated={match.status === "validated"}
                chosen={compared ? { id: compared.antalis_product.id, title: compared.antalis_product.title ?? `Product #${compared.antalis_product.id}` } : null}
                hasRejections={match.rejected_antalis_products.length > 0}
                nextHref={nav?.next?.href ?? null}
              />
            </div>
          </Card>

          <section id="choose" className="space-y-3">
            <Card title="Choose another Antalis product" description="Search the reference catalog, then preview the score breakdown before validating.">
              <form method="get" action={`/matching/products/${productId}#choose`} className="flex flex-wrap items-end gap-2">
                {Object.entries(context).map(([key, value]) =>
                  (Array.isArray(value) ? value : value ? [value] : []).map((v) => <input key={`${key}-${v}`} type="hidden" name={key} value={v} />),
                )}
                <input className={`${inputClass} w-80 max-w-full`} name="find" defaultValue={find} placeholder="Title, reference, brand…" aria-label="Search Antalis products" />
                <button type="submit" className={primaryButton}>
                  Search
                </button>
                {find || compareId ? (
                  <Link href={here({})} className={secondaryButton}>
                    Clear
                  </Link>
                ) : null}
              </form>

              {search?.error ? <div className="mt-4"><ApiUnavailable message={search.error} /></div> : null}
              {search?.data ? (
                search.data.items.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">No Antalis product matches “{find}”.</p>
                ) : (
                  <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {search.data.items.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <Link href={`/products/${p.id}`} className="line-clamp-1 text-sm font-medium text-slate-800 hover:text-indigo-600">
                            {p.title ?? "Untitled product"}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {p.catalog_reference ? <code>{p.catalog_reference}</code> : null} {p.brand ?? ""}
                          </p>
                        </div>
                        <Link
                          href={`${here({ find, compare: String(p.id) })}#choose`}
                          className={`${compareId === p.id ? primaryButton : secondaryButton} h-8 shrink-0 px-3 text-xs`}
                        >
                          {compareId === p.id ? "Previewing" : "Preview"}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </Card>

            {comparison?.error ? <ApiUnavailable message={comparison.error} /> : null}
            {comparison?.data ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-900">Preview: score breakdown against the chosen product</p>
                {!comparison.data.semantic_available ? (
                  <Notice tone="warning">An embedding is missing for one of the products: the score uses the other criteria only.</Notice>
                ) : null}
                <CandidateCard candidate={comparison.data.candidate} />
                <p className="text-xs text-slate-500">Use “Validate with the chosen product” in the Decision panel above to associate it.</p>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Candidates <span className="font-normal text-slate-500">· ranked by the engine</span>
            </h2>
            {ranked.length > 0 ? (
              ranked.map((c) => (
                <CandidateCard
                  key={c.antalis_product.id}
                  candidate={c}
                  action={
                    !c.is_proposed && !c.is_associated ? (
                      <Link href={`${here({ compare: String(c.antalis_product.id) })}#choose`} className="text-xs font-medium text-indigo-600 hover:text-indigo-500">
                        Choose this one
                      </Link>
                    ) : null
                  }
                />
              ))
            ) : (
              <EmptyState title="No compatible candidate">The engine found no Antalis product that can be associated.</EmptyState>
            )}

            {excluded.length > 0 ? (
              <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <summary className="cursor-pointer select-none text-sm font-medium text-slate-900">
                  Excluded candidates ({excluded.length})
                  <span className="ml-2 font-normal text-slate-500">certain incompatibilities</span>
                </summary>
                <div className="mt-4 space-y-3">
                  {excluded.map((c) => (
                    <CandidateCard key={c.antalis_product.id} candidate={c} />
                  ))}
                </div>
              </details>
            ) : null}
          </section>
        </div>

        <div className="space-y-6">
          <Card title="What the engine read" description="Competitor product as analysed for matching">
            {match.analysis ? <Analysis analysis={match.analysis} /> : <p className="text-sm text-slate-500">The product can no longer be read.</p>}
          </Card>

          {match.rejected_antalis_products.length > 0 ? (
            <Card title="Rejected by reviewers" description="Never proposed again">
              <ul className="space-y-3">
                {match.rejected_antalis_products.map((p) => (
                  <li key={p.id}>
                    <ProductCell product={p} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card title="History" description={`Revision ${match.revision}`} padded={false}>
            {match.history.length > 0 ? (
              <MatchEventList events={match.history} />
            ) : (
              <p className="p-5 text-sm text-slate-500">No event yet.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function StatusSummary({ match }: { match: MatchDetail }) {
  const associated = match.antalis_product;
  const proposed = match.proposed_antalis_product;
  return (
    <div className="space-y-4">
      {match.status === "deprecated" ? (
        <Notice tone="warning">
          Obsolete{match.deprecated_reason ? `: ${DEPRECATED_REASON_LABELS[match.deprecated_reason].toLowerCase()}` : ""}
          {match.deprecated_at ? ` (${formatDateTime(match.deprecated_at)})` : ""}. Previous status:{" "}
          {match.previous_status ? MATCH_STATUS_LABELS[match.previous_status] : "—"}. The former association below stays visible until the
          next run.
        </Notice>
      ) : null}
      {match.outdated_config ? (
        <Notice>Computed with an older matching configuration: the next incremental run refreshes it.</Notice>
      ) : null}

      <DefinitionList
        items={[
          {
            label: match.status === "deprecated" ? "Former association" : "Associated Antalis product",
            value: <ProductCell product={associated} />,
          },
          { label: "Engine proposal", value: <ProductCell product={proposed} /> },
          {
            label: "Score",
            value: (
              <span className="inline-flex flex-wrap items-center gap-3">
                <ScoreGauge score={match.score} />
                <span className="text-xs text-slate-500">
                  2nd candidate {formatScore(match.runner_up_score)} · gap {formatScore(match.score_gap)}
                </span>
              </span>
            ),
          },
          { label: "Dimensions compared", value: match.dimensions_compared ? "Yes" : "No" },
          ...(match.decided_by || match.decided_at
            ? [
                { label: "Decided", value: `${match.decided_by ?? "—"} · ${formatDateTime(match.decided_at)}` },
                { label: "Comment", value: match.decision_comment ?? "—" },
              ]
            : []),
          {
            label: "Computed",
            value: (
              <span>
                {formatDateTime(match.computed_at)}
                {match.job_id ? (
                  <>
                    {" · "}
                    <Link href={`/jobs/${match.job_id}`} className="text-indigo-600 hover:text-indigo-500">
                      job #{match.job_id}
                    </Link>
                  </>
                ) : null}
              </span>
            ),
          },
        ]}
      />

      {match.decision_reasons.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Why this status</p>
          <DecisionReasons reasons={match.decision_reasons} />
        </div>
      ) : null}
    </div>
  );
}

function Analysis({ analysis }: { analysis: ProductAnalysis }) {
  const dimensions = Object.entries(analysis.dimensions ?? {});
  const features = Object.entries(analysis.features ?? {});
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Title</p>
        <p className="mt-1 text-slate-900">{analysis.title}</p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Category</p>
        <p className="mt-1 text-slate-900">{analysis.category ?? "—"}</p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Product type</p>
        <p className="mt-1 text-slate-900">
          {analysis.product_type ? labelize(analysis.product_type) : "Unknown"}
          {analysis.product_type_source ? <span className="text-xs text-slate-500"> · from {analysis.product_type_source}</span> : null}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Dimensions</p>
        {dimensions.length > 0 ? (
          <ul className="mt-1 space-y-1">
            {dimensions.map(([key, d]) => (
              <li key={key} className="flex justify-between gap-3">
                <span className="text-slate-600">{d.label}</span>
                <span className="text-right tabular-nums text-slate-900">
                  {formatMeasure(d.value, d.unit)}
                  <span className="ml-1.5 text-xs text-slate-400">{d.source}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-slate-500">No measure with an explicit unit.</p>
        )}
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Characteristics</p>
        {features.length > 0 ? (
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {features.map(([key, values]) => (
              <li key={key}>
                <Badge tone="neutral">
                  {labelize(key)}: {values.join(", ")}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-slate-500">None detected.</p>
        )}
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Description used</p>
        {analysis.description_used ? (
          <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-line text-slate-700">{analysis.description_used}</p>
        ) : (
          <p className="mt-1 text-slate-500">None.</p>
        )}
      </div>
    </div>
  );
}
