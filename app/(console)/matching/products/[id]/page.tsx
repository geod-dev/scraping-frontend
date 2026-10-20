import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheckIcon, UserCheckIcon, UserXIcon } from "lucide-react";
import { CandidateCard } from "@/components/candidate-card";
import { DecisionBar } from "@/components/decision-panel";
import { FilterBar, FilterSearch } from "@/components/filters";
import { KeyboardNav } from "@/components/keyboard-nav";
import { ApiUnavailable, DefinitionList, EmptyState, Notice, PageHeader, Panel, ToneBadge } from "@/components/kit";
import { SplitComparison, toSide } from "@/components/match-compare";
import { DecisionReasons, MatchEventList, MatchStatusBadge, ProductCell, ScoreRing, SubScore } from "@/components/matching";
import { PriceLine } from "@/components/price";
import { ProductThumb } from "@/components/product-thumb";
import { ReviewStage, SessionCounter } from "@/components/review-session";
import { buttonVariants } from "@/components/ui/button";
import { apiFetch, isApiError, settle } from "@/lib/api";
import { formatDateTime, labelize } from "@/lib/format";
import { firstImage } from "@/lib/images";
import { MATCH_LIST_PATHS, parseMatchFilters, reviewHref, type MatchListKind } from "@/lib/match-filters";
import { DEPRECATED_REASON_LABELS, MATCH_STATUS_DESCRIPTIONS, MATCH_STATUS_LABELS, formatMeasure, formatScore, scoreThresholds, type Thresholds } from "@/lib/matching";
import { buildQuery, oneOf, positiveInt, text, type QueryValues, type SearchParams } from "@/lib/params";
import type { Candidate, CompareResult, Competitor, MatchDetail, MatchEvent, MatchListItem, MatchingConfig, Paginated, ProductAnalysis, ProductDetail, ProductListItem } from "@/lib/types";

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
  const page = await settle(apiFetch<Paginated<MatchListItem>>(`/matching/${kind}`, { query: { ...filters.query, limit: 3, offset: start } }));
  if (!page.data) return { filters, prev: null, next: null, total: null, index: null };
  const items = page.data.items;
  const link = (i: number): Neighbour => (items[i] ? { href: reviewHref(items[i].product.id, { kind, values: filters.values, position: start + i }), title: items[i].product.title } : null);
  const at = items.findIndex((m) => m.product.id === productId);
  if (at >= 0) return { filters, prev: link(at - 1), next: link(at + 1), total: page.data.total, index: start + at };
  const here = position - start;
  return { filters, prev: link(here - 1), next: link(here), total: page.data.total, index: null };
}

export default async function MatchReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
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

  const breadcrumbs = [{ label: "Matching", href: "/matching" }];

  let match: MatchDetail;
  try {
    match = await apiFetch<MatchDetail>(`/matching/products/${productId}`);
  } catch (error) {
    if (isApiError(error) && error.code === "match_not_found") {
      return (
        <>
          <PageHeader title="Not matched yet" breadcrumbs={breadcrumbs} />
          <EmptyState title="This product has not been matched yet">
            It will be scored by the next matching run of its competitor.{" "}
            <Link href={`/products/${productId}`}>Open the product</Link> or go to the <Link href="/matching">matching overview</Link>.
          </EmptyState>
        </>
      );
    }
    if (isApiError(error) && error.status === 404) notFound();
    return (
      <>
        <PageHeader title="Review" breadcrumbs={breadcrumbs} />
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
  const thresholds = scoreThresholds(config.data);

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
  const shownScore = shownCandidate?.score ?? (compareId ? null : match.score);

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

      <PageHeader
        breadcrumbs={[...breadcrumbs, { label: from ? LIST_LABELS[from] : "All matches", href: backHref }, { label: `#${match.product.id}` }]}
        title={match.product.title ?? "Untitled product"}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <MatchStatusBadge status={match.status} manualChoice={match.manual_choice} />
            <span>{origin(match.competitor_key, match.competitor_key).name}</span>
            {match.product.catalog_reference ? <code className="text-xs">{match.product.catalog_reference}</code> : null}
          </span>
        }
        actions={
          <>
            {/* The score stays in sight once the header condenses. */}
            <span className="hidden group-data-[condensed=true]/header:block">
              <ScoreRing score={shownScore} thresholds={thresholds} size={34} />
            </span>
            <SessionCounter />
          </>
        }
      />

      <ReviewStage key={productId}>
        <ScoreHero
          match={match}
          candidate={shownCandidate}
          score={shownScore}
          previewing={Boolean(compareId)}
          semanticMissing={comparison?.data ? !comparison.data.semantic_available : false}
          thresholds={thresholds}
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
              The engine proposes nothing for this product. <a href="#choose">Search the Antalis catalog</a> to preview one.
            </EmptyState>
          }
        />

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">
                Candidates <span className="font-normal text-muted-foreground">· ranked by the engine</span>
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
                      thresholds={thresholds}
                      action={
                        current ? (
                          <ToneBadge tone="info">Shown above</ToneBadge>
                        ) : (
                          <Link href={`${isDefault ? here({}) : here({ compare: String(c.antalis_product.id) })}#comparison`} className={buttonVariants({ variant: "outline", size: "sm" })}>
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

            <Panel title="Choose another Antalis product" description="Search the reference catalog, then compare a product side by side before validating." className="scroll-mt-24">
              <div id="choose" className="scroll-mt-28 space-y-4">
                <FilterBar>
                  <FilterSearch name="find" label="Search Antalis products" placeholder="Title, reference, brand…" className="w-full max-w-md" />
                  {find || compareId ? (
                    <Link href={here({})} className="text-sm font-medium text-muted-foreground hover:text-foreground">
                      Clear
                    </Link>
                  ) : null}
                </FilterBar>

                {search?.error ? <ApiUnavailable message={search.error} /> : null}
                {search?.data ? (
                  search.data.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No Antalis product matches “{find}”.</p>
                  ) : (
                    <ul className="divide-y rounded-lg ring-1 ring-foreground/10">
                      {search.data.items.map((p) => (
                        <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                          <ProductThumb src={firstImage(p.images)} />
                          <div className="min-w-0 flex-1">
                            <Link href={`/products/${p.id}`} className="line-clamp-1 text-sm font-medium hover:text-primary">
                              {p.title ?? "Untitled product"}
                            </Link>
                            <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                              {p.catalog_reference ? <code>{p.catalog_reference}</code> : null}
                              {p.brand ? <span>{p.brand}</span> : null}
                              <PriceLine price={p.latest_price} />
                            </p>
                          </div>
                          {compareId === p.id ? (
                            <ToneBadge tone="warning">Shown above</ToneBadge>
                          ) : (
                            <Link href={`${here({ find, compare: String(p.id) })}#comparison`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                              Compare
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}
              </div>
            </Panel>

            {excluded.length > 0 ? (
              <details className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <summary className="cursor-pointer text-sm font-medium select-none">
                  Excluded candidates ({excluded.length})<span className="ml-2 font-normal text-muted-foreground">certain incompatibilities</span>
                </summary>
                <div className="mt-4 space-y-3">
                  {excluded.map((c) => (
                    <CandidateCard key={c.antalis_product.id} candidate={c} current={c.antalis_product.id === rightId} thresholds={thresholds} />
                  ))}
                </div>
              </details>
            ) : null}
          </div>

          <div className="space-y-6">
            <Panel title="Matching details" description={MATCH_STATUS_DESCRIPTIONS[match.status]}>
              <StatusSummary match={match} />
            </Panel>

            {match.rejected_antalis_products.length > 0 ? (
              <Panel title="Rejected by reviewers" description="Never proposed again">
                <ul className="space-y-3">
                  {match.rejected_antalis_products.map((p) => (
                    <li key={p.id}>
                      <ProductCell product={p} />
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}

            <Panel title="What the engine read" description="Competitor product as analysed for matching">
              {match.analysis ? <Analysis analysis={match.analysis} /> : <p className="text-sm text-muted-foreground">The product can no longer be read.</p>}
            </Panel>

            <Panel title="History" description={`Revision ${match.revision}`} flush>
              {match.history.length > 0 ? <MatchEventList events={match.history} /> : <p className="px-4 text-sm text-muted-foreground">No event yet.</p>}
            </Panel>
          </div>
        </div>
      </ReviewStage>

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
  score,
  previewing,
  semanticMissing,
  thresholds,
}: {
  match: MatchDetail;
  candidate: Candidate | null;
  score: number | null;
  previewing: boolean;
  semanticMissing: boolean;
  thresholds: Thresholds;
}) {
  const delta = previewing && candidate && match.score !== null ? candidate.score - match.score : null;
  return (
    <section className="mb-6 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <ScoreRing score={score} thresholds={thresholds} label={previewing ? "Preview" : "Score"} size={120} />

        <div className="min-w-0 flex-1 space-y-4">
          <HumanDecision match={match} />
          <p className="text-sm text-muted-foreground">
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
                2nd candidate {formatScore(match.runner_up_score)} · gap <span className="font-medium text-foreground">{formatScore(match.score_gap)}</span>
                {thresholds.auto !== null ? <span> · automatic from {formatScore(thresholds.auto)}</span> : null}
              </>
            )}
          </p>
          {candidate ? (
            <div className="grid max-w-xl grid-cols-3 gap-4">
              <SubScore label="Semantic" value={candidate.semantic_score} weight={candidate.weights.semantic} />
              <SubScore label="Lexical" value={candidate.lexical_score} weight={candidate.weights.lexical} />
              <SubScore label="Dimensions" value={candidate.dimension_score} weight={candidate.weights.dimensions} />
            </div>
          ) : null}
          {match.decision_reasons.length > 0 && !previewing ? <DecisionReasons reasons={match.decision_reasons} compact /> : null}
        </div>

        <div className="space-y-2 md:w-80">
          {semanticMissing ? <Notice tone="warning">An embedding is missing for one of the products: the score uses the other criteria only.</Notice> : null}
          {candidate && candidate.exclusions.length > 0 ? <Flags title="Cannot be associated" tone="danger" messages={candidate.exclusions.map((f) => f.message)} /> : null}
          {candidate && candidate.review_flags.length > 0 ? <Flags title="Prevents an automatic association" tone="warning" messages={candidate.review_flags.map((f) => f.message)} /> : null}
          {candidate && candidate.exclusions.length === 0 && candidate.review_flags.length === 0 ? (
            <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-emerald-200">
              <CircleCheckIcon className="size-4" /> No conflict detected by the engine
            </p>
          ) : null}
          {candidate?.rejected_by_human ? <Flags title="Already rejected by a reviewer" tone="danger" messages={[]} /> : null}
        </div>
      </div>
    </section>
  );
}

// The human decision event behind the current status (newest first in the history).
function decisionEvent(match: MatchDetail): MatchEvent | null {
  if (!match.decided_at) return null;
  return match.history.find((e) => (e.event === "validated" || e.event === "rejected") && e.to_status === match.status) ?? null;
}

// Who validated or rejected the match, when, and their comment (else the reason recorded
// with the decision).
function HumanDecision({ match }: { match: MatchDetail }) {
  if (!match.decided_by && !match.decided_at) return null;
  const rejected = match.status === "rejected";
  const Icon = rejected ? UserXIcon : UserCheckIcon;
  const note = match.decision_comment ?? decisionEvent(match)?.reason ?? null;
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-muted/60 px-3 py-2 text-sm">
      <Icon className={rejected ? "mt-0.5 size-4 shrink-0 text-rose-600" : "mt-0.5 size-4 shrink-0 text-emerald-600"} aria-hidden />
      <div className="min-w-0">
        <p>
          <span className="font-medium">
            {rejected ? "Rejected" : "Validated"} by {match.decided_by ?? "someone"}
          </span>
          {match.decided_at ? <span className="text-muted-foreground"> · {formatDateTime(match.decided_at)}</span> : null}
        </p>
        {note ? <p className="text-muted-foreground">{match.decision_comment ? `“${note}”` : note}</p> : null}
      </div>
    </div>
  );
}

function Flags({ title, tone, messages }: { title: string; tone: "danger" | "warning"; messages: string[] }) {
  return (
    <div className={tone === "danger" ? "rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 ring-1 ring-rose-200" : "rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200"}>
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
  return (
    <div className="space-y-4">
      {match.status === "deprecated" ? (
        <Notice tone="warning">
          Obsolete{match.deprecated_reason ? `: ${DEPRECATED_REASON_LABELS[match.deprecated_reason].toLowerCase()}` : ""}
          {match.deprecated_at ? ` (${formatDateTime(match.deprecated_at)})` : ""}. Previous status: {match.previous_status ? MATCH_STATUS_LABELS[match.previous_status] : "—"}. The former
          association stays visible until the next run.
        </Notice>
      ) : null}
      {match.outdated_config ? <Notice>Computed with an older matching configuration: the next incremental run refreshes it.</Notice> : null}

      <DefinitionList
        columns={1}
        items={[
          { label: match.status === "deprecated" ? "Former association" : "Associated Antalis product", value: <ProductCell product={match.antalis_product} /> },
          { label: "Engine proposal", value: <ProductCell product={match.proposed_antalis_product} /> },
          { label: "Dimensions compared", value: match.dimensions_compared ? "Yes" : "No" },
          ...(match.decided_by || match.decided_at
            ? [
                { label: "Decided", value: `${match.decided_by ?? "—"} · ${formatDateTime(match.decided_at)}` },
                { label: "Comment", value: match.decision_comment ?? decisionEvent(match)?.reason ?? "—" },
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
                    <Link href={`/jobs/${match.job_id}`} className="text-primary hover:text-primary/80">
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
          <p className="mb-1 text-xs font-medium text-muted-foreground">Why this status</p>
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
      <DefinitionList
        columns={1}
        items={[
          { label: "Title", value: analysis.title },
          { label: "Category", value: analysis.category ?? "—" },
          {
            label: "Product type",
            value: (
              <>
                {analysis.product_type ? labelize(analysis.product_type) : "Unknown"}
                {analysis.product_type_source ? <span className="text-xs text-muted-foreground"> · from {analysis.product_type_source}</span> : null}
              </>
            ),
          },
        ]}
      />
      <div>
        <p className="text-xs font-medium text-muted-foreground">Dimensions</p>
        {dimensions.length > 0 ? (
          <ul className="mt-1 space-y-1">
            {dimensions.map(([key, d]) => (
              <li key={key} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{d.label}</span>
                <span className="text-right tabular-nums">
                  {formatMeasure(d.value, d.unit)}
                  <span className="ml-1.5 text-xs text-muted-foreground">{d.source}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-muted-foreground">No measure with an explicit unit.</p>
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Characteristics</p>
        {features.length > 0 ? (
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {features.map(([key, values]) => (
              <li key={key}>
                <ToneBadge className="h-auto whitespace-normal">
                  {labelize(key)}: {values.join(", ")}
                </ToneBadge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-muted-foreground">None detected.</p>
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Description (characteristics only)</p>
        {analysis.description_used ? <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-line text-foreground/80">{analysis.description_used}</p> : <p className="mt-1 text-muted-foreground">None.</p>}
      </div>
    </div>
  );
}
