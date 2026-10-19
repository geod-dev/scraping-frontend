// Types mirroring the Competitor catalog API (OpenAPI 3.1, v0.1.0).
// Source: docs/openapi.json

export type Paginated<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type CategoryStatus = "active" | "missing";
export type ProductStatus = "active" | "missing";
export type TaskName = "catalog_sync" | "price_refresh";
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
export type MatchStatus = "proposed" | "validated" | "rejected";
export type NotificationLevel = "info" | "success" | "warning" | "error";

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
  products?: number | null;
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
  tasks: Record<string, { allowed: boolean; reason?: "worker_busy" | "catalog_required" | "competitor_disabled" | null }>;
};

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
  estimates: Record<string, unknown>;
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
  created_at: string;
  updated_at: string;
};

export type CategoryDetail = Category & {
  path: CategoryRef[];
  children_count: number;
  product_count: number;
  subtree_product_count: number;
};

export type CategoryTreeNode = {
  id: number;
  name: string;
  kind: string | null;
  status: CategoryStatus;
  external_id: string | null;
  product_count: number;
  subtree_product_count: number;
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
  antalis_reference: string | null;
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
};

export type ProductDetail = ProductListItem & {
  long_description: string | null;
  attributes: unknown[] | null;
  extra: Record<string, unknown>;
  last_seen_run_id: number | null;
  category_path: CategoryRef[];
  latest_prices: Observation[];
  match_count: number;
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
  item_counts: Record<string, number>;
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

export type ProductMatch = {
  id: number;
  product_a_id: number;
  product_b_id: number;
  match_type: string;
  confidence: string | null;
  status: MatchStatus;
  method: string | null;
  evidence: Record<string, unknown>;
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
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
