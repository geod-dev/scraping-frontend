import type { DeprecatedReason, MatchEventKind, MatchStatus, MatchingConfig, MatchingMode, TaskUnavailableReason } from "@/lib/types";

// Labels and helpers for the product matching screens (server and client safe).

export const MATCH_STATUSES: readonly MatchStatus[] = [
  "needs_review",
  "auto_matched",
  "validated",
  "no_match",
  "rejected",
  "deprecated",
];

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  auto_matched: "Automatic",
  validated: "Validated",
  needs_review: "Needs review",
  no_match: "No equivalent",
  rejected: "Rejected",
  deprecated: "Obsolete",
};

export const MATCH_STATUS_DESCRIPTIONS: Record<MatchStatus, string> = {
  auto_matched: "Associated automatically by the engine",
  validated: "Associated by a human",
  needs_review: "A proposal waits for a human review",
  no_match: "No acceptable Antalis product",
  rejected: "A human confirmed there is no equivalent",
  deprecated: "Data changed since the decision: rerun needed",
};

export const DEPRECATED_REASONS: readonly DeprecatedReason[] = [
  "product_changed",
  "antalis_product_changed",
  "antalis_product_missing",
  "antalis_product_deleted",
  "reset_requested",
];

export const DEPRECATED_REASON_LABELS: Record<DeprecatedReason, string> = {
  product_changed: "Competitor product changed",
  antalis_product_changed: "Antalis product changed",
  antalis_product_missing: "Antalis product no longer listed",
  antalis_product_deleted: "Antalis product deleted",
  reset_requested: "Sent back to the engine",
};

export const DECISION_REASON_LABELS: Record<string, string> = {
  score_above_auto: "Score above the automatic threshold",
  clear_gap: "Clearly ahead of the 2nd candidate",
  single_candidate: "Only one candidate",
  ambiguous_gap: "Too close to the 2nd candidate",
  review_band: "Score in the review band",
  score_below_review: "Score below the review threshold",
  no_compatible_candidate: "No compatible candidate",
  feature_conflict: "Conflicting characteristic",
  dimensions_not_comparable: "Dimensions not comparable",
  previously_validated: "Previously validated",
  previous_association_changed: "Previous association changed",
};

export const MATCH_EVENTS: readonly MatchEventKind[] = ["computed", "recomputed", "validated", "rejected", "deprecated", "reset"];

export const MATCH_EVENT_LABELS: Record<MatchEventKind, string> = {
  computed: "Computed",
  recomputed: "Recomputed",
  validated: "Validated",
  rejected: "Rejected",
  deprecated: "Became obsolete",
  reset: "Sent back to the engine",
};

export const MATCHING_MODES: { mode: MatchingMode; label: string; description: string }[] = [
  {
    mode: "incremental",
    label: "Incremental",
    description: "New products, obsolete matches and results computed with another configuration or catalog state.",
  },
  { mode: "deprecated", label: "Obsolete only", description: "Only the matches that became obsolete." },
  { mode: "all", label: "Everything", description: "Recompute every engine result. Human decisions are kept." },
];

export const TASK_UNAVAILABLE_LABELS: Record<TaskUnavailableReason, string> = {
  worker_busy: "The worker is busy with another job",
  catalog_required: "Run a full catalog sync of this competitor first",
  competitor_disabled: "This competitor is disabled",
  matching_reference: "Antalis is the reference catalog: it is not matched",
  matching_running: "A matching job is running",
  reference_catalog_required: "The Antalis catalog has not been fully synced yet",
  reference_missing: "The Antalis catalog is not in the database",
  matching_not_configured: "Matching is not configured on the server (no Voyage API key)",
};

export const MATCH_SORTS = ["score", "score_gap", "updated_at", "computed_at", "decided_at", "deprecated_at", "title", "id"] as const;

export const MATCH_SORT_LABELS: Record<(typeof MATCH_SORTS)[number], string> = {
  score: "Score",
  score_gap: "Gap to 2nd",
  updated_at: "Updated",
  computed_at: "Computed",
  decided_at: "Decided",
  deprecated_at: "Became obsolete",
  title: "Title",
  id: "ID",
};

export function decisionReasonLabel(code: string, message?: string): string {
  return DECISION_REASON_LABELS[code] ?? message ?? code.replace(/_/g, " ");
}

export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(1).replace(/\.0$/, "");
}

export function formatMeasure(values: number[] | null | undefined, unit?: string | null): string {
  if (!values || values.length === 0) return "—";
  return `${values.map((v) => String(Number(v.toFixed(2)))).join(" × ")}${unit ? ` ${unit}` : ""}`;
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// Engine thresholds of the automatic association and of the review band, when the
// configuration exposes them (key names vary by engine version).
export type Thresholds = { auto: number | null; review: number | null };

export function scoreThresholds(config: MatchingConfig | null | undefined): Thresholds {
  const find = (word: string) => {
    const thresholds = config?.thresholds;
    if (!thresholds) return null;
    const key = Object.keys(thresholds).find((k) => k.toLowerCase().includes(word) && !k.toLowerCase().includes("gap"));
    return key ? thresholds[key] : null;
  };
  return { auto: find("auto"), review: find("review") };
}
