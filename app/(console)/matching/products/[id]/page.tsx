import Link from "next/link";
import { notFound } from "next/navigation";
import { CandidateCard } from "@/components/candidate-card";
import { DecisionBar } from "@/components/decision-panel";
import { KeyboardNav } from "@/components/keyboard-nav";
import { SplitComparison, toSide } from "@/components/match-compare";
import { DecisionReasons, MatchEventList, MatchStatusBadge, ProductCell, ScoreRing, SubScore } from "@/components/matching";
import { ReviewStage, SessionCounter } from "@/components/review-session";
import { ApiUnavailable, Badge, Card, DefinitionList, EmptyState, Notice, PageHeader, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { apiFetch, isApiError, settle } from "@/lib/api";
import { formatDateTime, labelize } from "@/lib/format";
import { MATCH_LIST_PATHS, parseMatchFilters, reviewHref, type MatchListKind } from "@/lib/match-filters";
import { DEPRECATED_REASON_LABELS, MATCH_STATUS_DESCRIPTIONS, MATCH_STATUS_LABELS, formatMeasure, formatScore } from "@/lib/matching";
import { buildQuery, oneOf, positiveInt, text, type QueryValues, type SearchParams } from "@/lib/params";
import type {
  Candidate,
  CompareResult,
  Competitor,
  MatchDetail,
  MatchListItem,
  MatchingConfig,
  Paginated,
  ProductAnalysis,
  ProductDetail,
  ProductListItem,
} from "@/lib/types";

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

// Engine thresholds by name, when the configuration exposes them (keys vary by engine version).
function threshold(thresholds: Record<string, number> | undefined, word: string): number | null {
  if (!thresholds) return null;
  const key = Object.keys(thresholds).find((k) => k.toLowerCase().includes(word) && !k.toLowerCase().includes("gap"));
  return key ? thresholds[key] : null;
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

  // Everything that only depends on the URL starts right away, in parallel with the match.
  const configP = settle(apiFetch<MatchingConfig>("/matching/config"));
  const competitorsP = settle(apiFetch<Competitor[]>("/competitors"));
  const productP = settle(apiFetch<ProductDetail>(`/products/${productId}`));
  const navP = from ? findNeighbours(from, sp, productId, position) : Promise.resolve(null);
  const comparisonP = compareId ? settle(apiFetch<CompareResult>(`/matching/products/${productId}/compare/${compareId}`)) : Promise.resolve(null);
  const compareDetailP = compareId ? settle(apiFetch<ProductDetail>(`/products/${compareId}`)) : null;
  const searchP = find
    ? configP.then((config) =>
        settle(
          apiFetch<Paginated<ProductListItem>>("/products", {
            query: { competitor: config.data?.reference_competitor ?? "antalis_fr", q: find, status: "active", limit: 10 },
          }),
        ),
      )
    : Promise.resolve(null);

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

  // The Antalis side: the previewed product, else the association, else the engine proposal.
  const defaultBrief = match.antalis_product ?? match.proposed_antalis_product;
  const rightId = compareId ?? defaultBrief?.id;
  const [config, competitors, product, nav, comparison, search, rightDetail] = await Promise.all([
    configP,
    competitorsP,
    productP,
    navP,
    comparisonP,
    searchP,
    compareDetailP ?? (rightId ? settle(apiFetch<ProductDetail>(`/products/${rightId}`)) : Promise.resolve(null)),
  ]);
  const referenceKey = config.data?.reference_competitor ?? "antalis_fr";
  const origin = (key: string, fallback: string) => {
    const competitor = competitors.data?.find((c) => c.key === key);
    return { name: competitor?.name ?? fallback, siteUrl: competitor?.base_url ?? null };
  };

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
  // Scores of the pair on screen: the preview, or the engine's own candidate for that product.
  const shownCandidate: Candidate | null = compareId ? compared : (match.candidates.find((c) => c.antalis_product.id === rightId) ?? null);

  const left = toSide(product.data, match.product, origin(match.competitor_key, match.competitor_key))!;
  const right = toSide(rightDetail?.data ?? null, compareId ? (compared?.antalis_product ?? null) : defaultBrief, origin(referenceKey, "Antalis"));
  const rightRole = compareId
    ? { label: "Previewing your choice", tone: "warning" as const }
    : match.antalis_product
      ? match.status === "deprecated"
        ? { label: "Former association", tone: "violet" as const }
        : { label: match.manual_choice ? "Associated · manual choice" : "Associated", tone: "success" as const }
      : match.proposed_antalis_product
        ? { label: "Engine proposal", tone: "info" as const }
        : null;

  const queue = nav && nav.index !== null && nav.total !== null ? { index: nav.index, total: nav.total } : null;

  return (
    <>
      <KeyboardNav prevHref={nav?.prev?.href ?? null} nextHref={nav?.next?.href ?? null} />

      {/* Bottom padding keeps the last content above the fixed decision bar. */}
      <div className="pb-52 sm:pb-36">
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
          <SessionCounter />
        </nav>

        <ReviewStage key={productId}>
          <ScoreHero
            match={match}
            candidate={shownCandidate}
            previewing={Boolean(compareId)}
            semanticMissing={comparison?.data ? !comparison.data.semantic_available : false}
            auto={threshold(config.data?.thresholds, "auto")}
            review={threshold(config.data?.thresholds, "review")}
          />

          {comparison?.error ? (
            <div className="mb-4">
              <ApiUnavailable message={`Preview of product #${compareId}: ${comparison.error}`} />
            </div>
          ) : null}

          <SplitComparison
            left={left}
            right={right}
            rightRole={rightRole}
            candidate={shownCandidate}
            empty={
              <EmptyState title="No Antalis product to compare">
                The engine proposes nothing for this product.{" "}
                <a href="#choose" className="text-indigo-600 hover:text-indigo-500">
                  Search the Antalis catalog
                </a>{" "}
                to preview one.
              </EmptyState>
            }
          />

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <Card title="Matching details" description={MATCH_STATUS_DESCRIPTIONS[match.status]}>
                <StatusSummary match={match} />
              </Card>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Candidates <span className="font-normal text-slate-500">· ranked by the engine</span>
                </h2>
                {ranked.length > 0 ? (
                  ranked.map((c) => {
                    const current = c.antalis_product.id === rightId;
                    const isDefault = c.antalis_product.id === defaultBrief?.id;
                    return (
                      <CandidateCard
                        key={c.antalis_product.id}
                        candidate={c}
                        current={current}
                        action={
                          current ? (
                            <Badge tone="info">Shown above</Badge>
                          ) : (
                            <Link
                              href={`${isDefault ? here({}) : here({ compare: String(c.antalis_product.id) })}#comparison`}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                            >
                              {isDefault ? "Back to this one" : "Compare side by side"}
                            </Link>
                          )
                        }
                      />
                    );
                  })
                ) : (
                  <EmptyState title="No compatible candidate">The engine found no Antalis product that can be associated.</EmptyState>
                )}
              </section>

              <Card
                title="Choose another Antalis product"
                description="Search the reference catalog, then compare it side by side before validating."
                className="scroll-mt-6"
              >
                <div id="choose" className="scroll-mt-24">
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

                  {search?.error ? (
                    <div className="mt-4">
                      <ApiUnavailable message={search.error} />
                    </div>
                  ) : null}
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
                            {compareId === p.id ? (
                              <Badge tone="warning">Shown above</Badge>
                            ) : (
                              <Link href={`${here({ find, compare: String(p.id) })}#comparison`} className={`${secondaryButton} h-8 shrink-0 px-3 text-xs`}>
                                Compare
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    )
                  ) : null}
                </div>
              </Card>

              {excluded.length > 0 ? (
                <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <summary className="cursor-pointer select-none text-sm font-medium text-slate-900">
                    Excluded candidates ({excluded.length})
                    <span className="ml-2 font-normal text-slate-500">certain incompatibilities</span>
                  </summary>
                  <div className="mt-4 space-y-3">
                    {excluded.map((c) => (
                      <CandidateCard key={c.antalis_product.id} candidate={c} current={c.antalis_product.id === rightId} />
                    ))}
                  </div>
                </details>
              ) : null}
            </div>

            <div className="space-y-6">
              <Card title="History" description={`Revision ${match.revision}`} padded={false}>
                {match.history.length > 0 ? <MatchEventList events={match.history} /> : <p className="p-5 text-sm text-slate-500">No event yet.</p>}
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

              <Card title="What the engine read" description="Competitor product as analysed for matching">
                {match.analysis ? <Analysis analysis={match.analysis} /> : <p className="text-sm text-slate-500">The product can no longer be read.</p>}
              </Card>
            </div>
          </div>
        </ReviewStage>
      </div>

      <DecisionBar
        key={productId}
        productId={match.product.id}
        proposal={proposal ? { id: proposal.id, title: proposal.title ?? `Product #${proposal.id}` } : null}
        validated={match.status === "validated"}
        chosen={compared ? { id: compared.antalis_product.id, title: compared.antalis_product.title ?? `Product #${compared.antalis_product.id}` } : null}
        hasRejections={match.rejected_antalis_products.length > 0}
        prev={nav?.prev ?? null}
        next={nav?.next ?? null}
        queue={queue}
      />
    </>
  );
}

// Score first: the ring of the pair on screen, its sub-scores, the gap to the runner-up and
// what blocks or flags the association.
function ScoreHero({
  match,
  candidate,
  previewing,
  semanticMissing,
  auto,
  review,
}: {
  match: MatchDetail;
  candidate: Candidate | null;
  previewing: boolean;
  semanticMissing: boolean;
  auto: number | null;
  review: number | null;
}) {
  const score = candidate?.score ?? (previewing ? null : match.score);
  const delta = previewing && candidate && match.score !== null ? candidate.score - match.score : null;
  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="flex items-center gap-4 md:block">
          <ScoreRing score={score} auto={auto} review={review} label={previewing ? "Preview" : "Score"} />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <MatchStatusBadge status={match.status} manualChoice={match.manual_choice} />
              <span>{match.competitor_key}</span>
              {match.product.catalog_reference ? <code>{match.product.catalog_reference}</code> : null}
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{match.product.title ?? "Untitled product"}</h1>
            <p className="text-sm text-slate-500">
              {previewing ? (
                <>
                  Engine’s best candidate {formatScore(match.score)}
                  {delta !== null ? (
                    <span className={delta >= 0 ? "text-emerald-700" : "text-rose-700"}>
                      {" "}
                      · this choice {delta >= 0 ? "+" : "−"}
                      {formatScore(Math.abs(delta))}
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  2nd candidate {formatScore(match.runner_up_score)} · gap <span className="font-medium text-slate-700">{formatScore(match.score_gap)}</span>
                  {auto !== null ? <span className="text-slate-400"> · automatic from {formatScore(auto)}</span> : null}
                </>
              )}
            </p>
          </div>
          {candidate ? (
            <div className="grid max-w-xl grid-cols-3 gap-4">
              <SubScore label="Semantic" value={candidate.semantic_score} weight={candidate.weights.semantic} />
              <SubScore label="Lexical" value={candidate.lexical_score} weight={candidate.weights.lexical} />
              <SubScore label="Dimensions" value={candidate.dimension_score} weight={candidate.weights.dimensions} />
            </div>
          ) : null}
        </div>

        <div className="space-y-2 md:w-80">
          {semanticMissing ? (
            <Notice tone="warning">An embedding is missing for one of the products: the score uses the other criteria only.</Notice>
          ) : null}
          {candidate && candidate.exclusions.length > 0 ? <Flags title="Cannot be associated" tone="danger" messages={candidate.exclusions.map((f) => f.message)} /> : null}
          {candidate && candidate.review_flags.length > 0 ? (
            <Flags title="Prevents an automatic association" tone="warning" messages={candidate.review_flags.map((f) => f.message)} />
          ) : null}
          {candidate && candidate.exclusions.length === 0 && candidate.review_flags.length === 0 ? (
            <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <span aria-hidden>✓</span> No conflict detected by the engine
            </p>
          ) : null}
          {candidate?.rejected_by_human ? <Flags title="Already rejected by a reviewer" tone="danger" messages={[]} /> : null}
          {match.decision_reasons.length > 0 && !previewing ? (
            <div className="text-xs">
              <DecisionReasons reasons={match.decision_reasons} compact />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Flags({ title, tone, messages }: { title: string; tone: "danger" | "warning"; messages: string[] }) {
  return (
    <div
      className={
        tone === "danger"
          ? "rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
          : "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
      }
    >
      <p className="font-medium">{title}</p>
      {messages.length > 0 ? (
        <ul className="mt-0.5 list-disc pl-4">
          {messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}
    </div>
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
          {match.previous_status ? MATCH_STATUS_LABELS[match.previous_status] : "—"}. The former association stays visible until the next
          run.
        </Notice>
      ) : null}
      {match.outdated_config ? <Notice>Computed with an older matching configuration: the next incremental run refreshes it.</Notice> : null}

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
              <span className="tabular-nums">
                {formatScore(match.score)}
                <span className="text-xs text-slate-500">
                  {" "}
                  · 2nd candidate {formatScore(match.runner_up_score)} · gap {formatScore(match.score_gap)}
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
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Description (characteristics only)</p>
        {analysis.description_used ? (
          <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-line text-slate-700">{analysis.description_used}</p>
        ) : (
          <p className="mt-1 text-slate-500">None.</p>
        )}
      </div>
    </div>
  );
}
