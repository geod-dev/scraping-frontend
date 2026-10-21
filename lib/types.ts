// Types mirroring the Competitor catalog API (OpenAPI 3.1, v0.1.0).
// Source: docs/openapi.json

export type Paginated<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type CategoryStatus = "active" | "missing";
// main: the category's subtree owns products (each product belongs to exactly one main
// category). extra: its subtree owns no product but lists products filed under other
// categories (promotions, pallet sales...); it can sit below a main category.
export type CategoryRole = "main" | "extra";
export type ProductStatus = "active" | "missing";
export type TaskName = "catalog_sync" | "price_refresh" | "matching";
export type JobStatus =
  | "queued"
  | "running"
  | "paused"
  | "succeeded"
  | "partial"
  | "failed"
  | "cancelled"
  | "interrupted";
export type WorkerState =
  | "idle"
  | "queued"
  | "running"
  | "pausing"
  | "paused"
  | "resuming"
  | "stopping";
export type RunStatus = "running" | "succeeded" | "partial" | "failed" | "aborted";
export type RunOperation = "catalog_discovery" | "price_refresh";
export type ItemStatus = "succeeded" | "failed" | "not_found" | "no_price" | "skipped";
export type ItemType = "listing_page" | "product";
export type NotificationLevel = "info" | "success" | "warning" | "error";
export type TaskUnavailableReason =
  | "worker_busy"
  | "catalog_required"
  | "competitor_disabled"
  | "matching_reference"
  | "matching_running"
  | "reference_missing"
  | "matching_not_configured"
  | "reference_catalog_required";

export type Health = {
  status: "ok" | "degraded";
  version: string;
  database: boolean;
  worker: {
    online: boolean;
    instance?: string | null;
    started_at?: string | null;
    heartbeat_at?: string | null;
    running_jobs?: number[];
    auto_schedule?: boolean;
  };
};

export type Stats = {
  competitors: number;
  categories: number;
  products_active: number;
  products_missing: number;
  observations: number;
  runs: number;
  active_jobs: number;
  unread_notifications: number;
};

export type CompetitorStats = {
  categories: number;
  // Banned categories: deleted and skipped by every catalog sync.
  banned_categories?: number;
  products_active: number;
  products_missing: number;
  observations: number;
  last_price_observed_at: string | null;
};

export type Progress = {
  percent?: number | null;
  requests_done?: number;
  requests_total?: number | null;
  requests_total_is_estimate?: boolean;
  seconds_per_request?: number | null;
  seconds_per_request_measured?: boolean;
  elapsed_seconds?: number | null;
  paused_seconds?: number;
  eta_seconds?: number | null;
  estimated_finish_at?: string | null;
  errors?: number;
  steps?: { name: string; label: string; status: "pending" | "running" | "done"; done?: number; goal?: number | null; pending?: number | null }[];
};

export type Estimate = {
  task: TaskName;
  listing_pages?: number | null;
  // Matching: products to score.
  products?: number | null;
  // Matching: product texts to embed (the others are cached).
  embeddings?: number | null;
  // HTTP requests (matching: Voyage AI requests).
  requests?: number | null;
  seconds_per_request: number;
  seconds?: number | null;
  credits?: number | null;
  basis?: string[];
};

export type Job = {
  id: number;
  competitor_id: number;
  competitor_key: string;
  task: TaskName;
  status: JobStatus;
  options: Record<string, unknown>;
  requested_by: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  heartbeat_at: string | null;
  cancel_requested_at: string | null;
  pause_requested_at: string | null;
  paused_at: string | null;
  scrape_run_id: number | null;
  // The job this one restarts (manual restart or automatic resume).
  resumed_from_job_id?: number | null;
  step: string | null;
  step_label: string | null;
  step_done: number;
  step_goal: number | null;
  progress: Progress;
  counters: Record<string, unknown>;
  estimate: Estimate | null;
  error: string | null;
  duration_seconds: number | null;
};

export type Worker = {
  competitor_key: string;
  state: WorkerState;
  job: Job | null;
  last_job: Job | null;
  tasks: Record<string, TaskAvailability>;
};

export type TaskAvailability = { allowed: boolean; reason?: TaskUnavailableReason | null };

export type Competitor = {
  id: number;
  key: string;
  name: string;
  base_url: string;
  adapter: string;
  enabled: boolean;
  last_full_catalog_at: string | null;
  last_full_catalog_run_id: number | null;
  last_full_catalog_status: string | null;
  last_price_refresh_at: string | null;
  created_at: string;
  updated_at: string;
  stats: CompetitorStats;
  worker: Worker;
};

export type CompetitorDetail = Competitor & {
  config: Record<string, unknown>;
  // Per task, with default options (no matching entry for the reference competitor).
  estimates: Partial<Record<TaskName, Estimate>>;
};

export type CategoryRef = {
  id: number;
  name: string;
  url: string;
  external_id: string | null;
};

export type Category = {
  id: number;
  competitor_id: number;
  parent_id: number | null;
  name: string;
  slug: string | null;
  url: string;
  external_id: string | null;
  kind: string | null;
  depth: number | null;
  breadcrumb: unknown[] | null;
  details: Record<string, unknown>;
  status: CategoryStatus;
  first_seen_at: string;
  last_seen_at: string;
  last_seen_run_id: number | null;
  missing_since: string | null;
  role: CategoryRole;
  created_at: string;
  updated_at: string;
};

export type CategoryDetail = Category & {
  path: CategoryRef[];
  children_count: number;
  product_count: number;
  subtree_product_count: number;
  // Products the category and its subtree show, listed ones included: what
  // GET /products?category_id= returns, and the count of an extra category.
  listed_product_count: number;
};

// A banned category: deleted with its subtree and skipped by the catalog syncs. `id` is the
// ban id; `category_id` the id the category had (it gets a new one when unbanned).
export type BannedCategory = {
  id: number;
  competitor_id: number;
  competitor_key: string;
  category_id: number;
  name: string;
  slug: string | null;
  url: string;
  external_id: string | null;
  kind: string | null;
  depth: number | null;
  breadcrumb: unknown[] | null;
  details: Record<string, unknown>;
  parent_url: string | null;
  // Current id of its parent category, if it still exists.
  parent_category_id?: number | null;
  first_seen_at: string | null;
  reason: string | null;
  banned_by: string | null;
  banned_at: string;
  // What the ban deleted; matches_deprecated = matches of other competitors that pointed to a
  // deleted reference product.
  deleted: Partial<Record<"categories" | "products" | "observations" | "matches" | "matches_deprecated", number>>;
};

// The recreated category (empty, new id) and the catalog sync queued with `scrape: true`.
export type UnbanResult = { category: Category; job: Job | null };

export type CategoryTreeNode = {
  id: number;
  name: string;
  kind: string | null;
  status: CategoryStatus;
  external_id: string | null;
  role: CategoryRole;
  // Products owned directly / by the subtree: always 0 for an extra category.
  product_count: number;
  subtree_product_count: number;
  // Products the category and its subtree show, listed ones included (what
  // GET /products?category_id= returns).
  listed_product_count: number;
  children?: CategoryTreeNode[];
};

export type PriceSummary = {
  observed_at: string;
  currency: string;
  from_price: string;
  min_price: string;
  tiers: number;
  price_basis: string;
  price_unit: string | null;
  price_unit_quantity: string | null;
  quantity_unit: string | null;
  tax_mode: string;
  displayed: boolean;
};

export type Observation = {
  id: number;
  product_id: number;
  scrape_run_id: number | null;
  capture_id: string;
  observed_at: string;
  quantity: string | null;
  min_quantity: string | null;
  max_quantity: string | null;
  max_inclusive: boolean;
  quantity_unit: string | null;
  price: string;
  currency: string;
  price_basis: "unit" | "total" | "unknown";
  price_unit: string | null;
  price_unit_quantity: string | null;
  tax_mode: "excl_tax" | "incl_tax" | "unknown";
  is_promotional: boolean | null;
  metadata: Record<string, unknown>;
};

export type ProductListItem = {
  id: number;
  competitor_id: number;
  category_id: number | null;
  identity_key: string;
  catalog_reference: string | null;
  external_id: string | null;
  url: string;
  title: string | null;
  brand: string | null;
  status: ProductStatus;
  first_seen_at: string;
  last_seen_at: string;
  missing_since: string | null;
  details_updated_at: string | null;
  last_price_observed_at: string | null;
  created_at: string;
  updated_at: string;
  description: string | null;
  normalized_attributes: Record<string, unknown> | null;
  images: unknown[] | null;
  latest_price: PriceSummary | null;
  // Last price movement of the product (null when its price never changed).
  price_trend?: PriceTrend | null;
};

export type PriceTrend = {
  previous_price: string;
  // (latest - previous) / previous * 100, on the same quantity basis as `from_price`.
  change_percent: number;
  changed_at: string;
};

export type ProductDetail = ProductListItem & {
  long_description: string | null;
  attributes: unknown[] | null;
  extra: Record<string, unknown>;
  last_seen_run_id: number | null;
  category_path: CategoryRef[];
  // Other categories that list this product (extra categories), directly or through its
  // family; by name.
  listed_in: CategoryRef[];
  latest_prices: Observation[];
  // Associations (auto_matched or validated) involving this product: competitor products
  // associated with it for a reference product, 0 or 1 for a competitor product.
  match_count: number;
  // Matching state of a competitor product (null for a reference product or before any run).
  matching?: MatchBrief | null;
};

export type ProductFacets = {
  total: number;
  brands: { value: string; count: number }[];
  statuses: { value: string; count: number }[];
  attributes: Record<string, { value: unknown; count: number }[]>;
};

export type Run = {
  id: number;
  competitor_id: number;
  operation: RunOperation;
  status: RunStatus;
  started_at: string;
  finished_at: string | null;
  heartbeat_at: string | null;
  full_scope: boolean;
  params: Record<string, unknown>;
  pages_fetched: number;
  pages_failed: number;
  categories_seen: number;
  products_seen: number;
  products_created: number;
  products_updated: number;
  products_failed: number;
  products_without_price: number;
  observations_created: number;
  categories_marked_missing: number;
  products_marked_missing: number;
  credits_used: number;
  error: string | null;
};

export type RunDetail = Run & {
  stats: Record<string, unknown>;
  // item_type -> status -> count
  item_counts: Record<string, Record<string, number>>;
};

export type RunItem = {
  id: number;
  scrape_run_id: number;
  item_type: ItemType;
  url: string;
  product_id: number | null;
  category_id: number | null;
  status: ItemStatus;
  error_type: string | null;
  error_message: string | null;
  http_status: number | null;
  warnings: unknown[] | null;
  created_at: string;
};

// --- Product matching (competitor products -> Antalis reference catalog) ---

export type MatchStatus = "auto_matched" | "needs_review" | "no_match" | "validated" | "rejected" | "deprecated";
export type DeprecatedReason =
  | "product_changed"
  | "antalis_product_changed"
  | "antalis_product_missing"
  | "antalis_product_deleted"
  | "reset_requested";
export type MatchEventKind = "computed" | "recomputed" | "validated" | "rejected" | "deprecated" | "reset";
export type MatchingMode = "incremental" | "deprecated" | "all";
export type MatchSort = "score" | "score_gap" | "updated_at" | "computed_at" | "decided_at" | "deprecated_at" | "title" | "id";

export type ProductBrief = {
  id: number;
  competitor_id: number;
  competitor_key: string;
  catalog_reference: string | null;
  title: string | null;
  url: string;
  brand: string | null;
  category: string | null;
  status: ProductStatus;
  normalized_attributes?: Record<string, unknown> | null;
  // Not sent by the API yet: shown as soon as it is.
  image_url?: string | null;
  images?: unknown[] | null;
};

export type MatchBrief = {
  match_id: number;
  status: MatchStatus;
  antalis_product_id: number | null;
  proposed_antalis_product_id: number | null;
  score: number | null;
};

export type Reason = { code: string; message: string };

export type MatchListItem = {
  id: number;
  competitor_id: number;
  competitor_key: string;
  status: MatchStatus;
  // The competitor product.
  product: ProductBrief;
  // The associated reference product (auto_matched / validated, kept when deprecated).
  antalis_product: ProductBrief | null;
  // The engine's best candidate.
  proposed_antalis_product: ProductBrief | null;
  // Similarity score on a 0-100 scale, NOT a probability.
  score: number | null;
  runner_up_score: number | null;
  score_gap: number | null;
  dimensions_compared: boolean;
  decision_reasons: Reason[];
  decided_by: string | null;
  decided_at: string | null;
  decision_comment: string | null;
  manual_choice: boolean;
  deprecated_at: string | null;
  deprecated_reason: DeprecatedReason | null;
  previous_status: MatchStatus | null;
  computed_at: string | null;
  job_id: number | null;
  outdated_config: boolean;
  revision: number;
  created_at: string;
  updated_at: string;
};

export type DimensionValue = { label: string; unit: string; value: number[]; source: string };

export type ProductAnalysis = {
  title: string;
  description_used: string | null;
  category: string | null;
  dimensions: Record<string, DimensionValue>;
  product_type: string | null;
  product_type_source: string | null;
  features: Record<string, string[]>;
};

export type Signal = { cosine: number | null; score: number | null };

export type Measure = {
  key: string;
  label: string;
  unit: string;
  competitor: number[] | null;
  reference: number[] | null;
  competitor_source?: string | null;
  reference_source?: string | null;
  relative_difference?: number | null;
  // 0..1; null when the measure is missing on one side.
  score?: number | null;
};

export type Feature = {
  key: string;
  competitor: unknown;
  reference: unknown;
  status: "match" | "conflict" | "unknown";
  policy?: "exclude" | "review" | null;
};

export type Difference = {
  kind: "dimension" | "feature";
  field: string;
  label?: string | null;
  competitor: unknown;
  reference: unknown;
  unit?: string | null;
  relative_difference?: number | null;
};

export type Flag = { code: string; message: string; field?: string | null };

export type Candidate = {
  // 1 = best; null for an excluded candidate.
  rank: number | null;
  excluded: boolean;
  antalis_product: ProductBrief;
  score: number;
  // Sub-scores 0..1; null = not comparable.
  semantic_score: number | null;
  lexical_score: number | null;
  dimension_score: number | null;
  is_proposed: boolean;
  is_associated: boolean;
  rejected_by_human: boolean;
  weights: Record<string, number>;
  semantic: Signal;
  lexical: Signal & { shared_terms?: string[] };
  dimensions: { comparable: boolean; score: number | null; measures: Measure[] };
  features: Feature[];
  differences: Difference[];
  // Certain incompatibilities: the candidate cannot be associated.
  exclusions: Flag[];
  // Conflicts that forbid an automatic association.
  review_flags: Flag[];
  retrieved_by: string[];
};

export type MatchEvent = {
  id: number;
  match_id: number;
  product_id: number;
  competitor_id: number;
  event: MatchEventKind;
  from_status: MatchStatus | null;
  to_status: MatchStatus | null;
  from_antalis_product_id: number | null;
  to_antalis_product_id: number | null;
  score: number | null;
  actor: string;
  reason: string | null;
  job_id: number | null;
  data: Record<string, unknown>;
  created_at: string;
  product_title?: string | null;
};

export type MatchDetail = MatchListItem & {
  analysis: ProductAnalysis | null;
  candidates: Candidate[];
  rejected_antalis_products: ProductBrief[];
  history: MatchEvent[];
};

export type CompareResult = {
  product: ProductBrief;
  analysis: ProductAnalysis;
  candidate: Candidate;
  // False when an embedding is missing: the score uses the other criteria.
  semantic_available: boolean;
};

export type MatchingAvailability = {
  allowed: boolean;
  reason?: TaskUnavailableReason | null;
  message?: string | null;
};

export type MatchingSummary = {
  competitor_id: number;
  competitor_key: string;
  competitor_name: string;
  availability: MatchingAvailability;
  counts: Record<string, number>;
  eligible_products: number;
  never_matched: number;
  needs_review: number;
  deprecated: number;
  outdated_by_config: number | null;
  embedding_tokens: number;
  last_computed_at: string | null;
  job?: Job | null;
  last_job?: Job | null;
};

export type MatchingConfig = {
  reference_competitor: string;
  configured: boolean;
  engine_version: string;
  thresholds: Record<string, number>;
  weights: Record<string, Record<string, number>>;
  embedding: Record<string, unknown>;
  config: Record<string, unknown>;
};

export type RerunResult = {
  jobs: Job[];
  refused: { competitor_key: string; code: string; message: string }[];
  nothing_to_do: string[];
};

export type Notification = {
  id: number;
  created_at: string;
  level: NotificationLevel;
  kind: string;
  title: string;
  message: string | null;
  competitor_id: number | null;
  job_id: number | null;
  scrape_run_id: number | null;
  data: Record<string, unknown>;
  read_at: string | null;
  read: boolean;
};

export type UnreadCount = {
  unread: number;
  by_level: Record<string, number>;
};

export type DimensionlessProduct = {
  product_id: number;
  catalog_reference: string | null;
  title: string | null;
  category: string | null;
  url: string | null;
  // Type read in the title, else the category name.
  product_type: string | null;
  // The title has numbers but no measure was read: likely a parsing gap.
  title_has_numbers: boolean;
  normalized_attributes: Record<string, unknown>;
};

export type DimensionlessPage = Paginated<DimensionlessProduct> & {
  // All products without dimensions of the competitor (before filters), "unknown" = none detected.
  by_product_type: Record<string, number>;
};

// --- Live console (server-sent events) and overview statistics ---

// Snapshot of what every page shows in the sidebar: sent when the event stream opens and
// again whenever one of its parts changes.
export type ConsoleSummary = {
  // Active jobs (queued, running, paused), newest first.
  jobs: Job[];
  competitors: { key: string; name: string; enabled: boolean; worker_state: WorkerState; job_id: number | null }[];
  matching: { needs_review: number; deprecated: number };
  notifications: { unread: number; by_level: Record<string, number> };
};

export type LiveEvent =
  | { type: "console.summary"; data: ConsoleSummary }
  // Progress or state of an active job (at most about once per second per job).
  | { type: "job.updated"; data: Job }
  // A job reached a final state (succeeded, partial, failed, cancelled, interrupted).
  | { type: "job.finished"; data: Job }
  | { type: "notification.created"; data: Notification }
  // Match counts of a competitor changed (run results, a decision, matches becoming obsolete).
  | { type: "matching.updated"; data: MatchingSummary }
  | { type: "competitor.updated"; data: Competitor };

export type LiveEventType = LiveEvent["type"];

export type DailyStats = {
  // YYYY-MM-DD, in the server's time zone.
  date: string;
  observations: number;
  products_created: number;
  products_marked_missing: number;
  price_changes: number;
  credits_used: number;
  jobs_succeeded: number;
  jobs_failed: number;
  matches_auto: number;
  matches_validated: number;
  matches_rejected: number;
};

export type PricePosition = {
  competitor_key: string;
  // Associated pairs (auto_matched or validated) with a comparable price on both sides.
  pairs: number;
  // Competitor cheaper / within 1% / pricier than Antalis.
  cheaper: number;
  same: number;
  pricier: number;
  // Median of (competitor - Antalis) / Antalis * 100.
  median_gap_percent: number | null;
};

export type OverviewStats = {
  days: number;
  daily: DailyStats[];
  totals: {
    observations: number;
    products_created: number;
    credits_used: number;
    price_increases: number;
    price_decreases: number;
    jobs: Partial<Record<JobStatus, number>>;
  };
  credits: { monthly_limit: number | null; monthly_remaining: number | null; renews_at: string | null };
  price_position: PricePosition[];
};
