import { DEPRECATED_REASONS, DECISION_REASON_LABELS, MATCH_SORTS, MATCH_STATUSES } from "@/lib/matching";
import { boolFlag, buildQuery, decimal, manyOf, oneOf, positiveInt, positiveInts, text, type QueryValues, type SearchParams } from "@/lib/params";

// Filters shared by the three match lists (/matching/matches, /review, /deprecated) and by
// the review screen, which receives them to navigate through the same list.

export type MatchListKind = "matches" | "review" | "deprecated";

export const MATCH_LIST_PATHS: Record<MatchListKind, string> = {
  matches: "/matching/matches",
  review: "/matching/review",
  deprecated: "/matching/deprecated",
};

export const DEFAULT_SORT: Record<MatchListKind, (typeof MATCH_SORTS)[number]> = {
  matches: "updated_at",
  review: "score",
  deprecated: "deprecated_at",
};

const REASON_CODES = Object.keys(DECISION_REASON_LABELS);

const flag = (value: boolean | undefined) => (value === undefined ? undefined : value ? "1" : "0");

export function parseMatchFilters(sp: SearchParams, kind: MatchListKind) {
  const competitor = text(sp.competitor, 64);
  const state = {
    competitor,
    // Categories belong to one competitor: ignored without it.
    categoryIds: competitor ? positiveInts(sp.category_id) : [],
    status: kind === "matches" ? manyOf(sp.status, MATCH_STATUSES) : [],
    q: text(sp.q),
    antalisQ: text(sp.antalis_q),
    antalisProductId: positiveInt(sp.antalis_product_id, 0) || undefined,
    minScore: decimal(sp.min_score, 0, 100),
    maxScore: decimal(sp.max_score, 0, 100),
    decided: kind === "review" ? undefined : boolFlag(sp.decided),
    manualChoice: kind === "review" ? undefined : boolFlag(sp.manual_choice),
    reason: oneOf(sp.reason, REASON_CODES),
    deprecatedReason: kind === "review" ? undefined : oneOf(sp.deprecated_reason, DEPRECATED_REASONS),
    dimensionsCompared: boolFlag(sp.dimensions_compared),
    productStatus: oneOf(sp.product_status, ["active", "missing"] as const),
    sort: oneOf(sp.sort, MATCH_SORTS) ?? DEFAULT_SORT[kind],
    order: oneOf(sp.order, ["asc", "desc"] as const) ?? "desc",
  };

  // Query for the API list endpoint.
  const query = {
    competitor: state.competitor,
    category_id: state.categoryIds.length > 0 ? state.categoryIds : undefined,
    status: state.status.length > 0 ? state.status : undefined,
    q: state.q,
    antalis_q: state.antalisQ,
    antalis_product_id: state.antalisProductId,
    min_score: state.minScore,
    max_score: state.maxScore,
    decided: state.decided,
    manual_choice: state.manualChoice,
    reason: state.reason ? [state.reason] : undefined,
    deprecated_reason: state.deprecatedReason ? [state.deprecatedReason] : undefined,
    dimensions_compared: state.dimensionsCompared,
    product_status: state.productStatus,
    sort: state.sort,
    order: state.order,
  };

  // Same filters as URL parameters (pagination, links to the review screen).
  const values: QueryValues = {
    competitor: state.competitor,
    category_id: state.categoryIds.map(String),
    status: state.status,
    q: state.q,
    antalis_q: state.antalisQ,
    antalis_product_id: state.antalisProductId ? String(state.antalisProductId) : undefined,
    min_score: state.minScore !== undefined ? String(state.minScore) : undefined,
    max_score: state.maxScore !== undefined ? String(state.maxScore) : undefined,
    decided: flag(state.decided),
    manual_choice: flag(state.manualChoice),
    reason: state.reason,
    deprecated_reason: state.deprecatedReason,
    dimensions_compared: flag(state.dimensionsCompared),
    product_status: state.productStatus,
    sort: state.sort === DEFAULT_SORT[kind] ? undefined : state.sort,
    order: state.order === "desc" ? undefined : state.order,
  };

  return { state, query, values };
}

// Link to the review screen of one product, keeping its position in the list it was opened from.
export function reviewHref(productId: number, from?: { kind: MatchListKind; values: QueryValues; position: number }): string {
  if (!from) return `/matching/products/${productId}`;
  const qs = buildQuery({ ...from.values, from: from.kind, pos: String(from.position) });
  return `/matching/products/${productId}?${qs}`;
}
