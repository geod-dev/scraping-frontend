import type { MatchingMode, TaskName } from "@/lib/types";

// Options of a job as chosen in the start dialog (server and client safe). The server action
// keeps those of the task and turns them into the API options.
export type TaskOptions = {
  // Every task: only this category and its sub-categories.
  categoryId?: number;
  // Catalog sync and price refresh: only what failed in that run.
  retryFailedRunId?: number;
  // Catalog sync.
  maxProducts?: number;
  skipProducts?: boolean;
  resumeWithinHours?: number;
  // Price refresh.
  skipFreshHours?: number;
  updateDetails?: boolean;
  includeMissing?: boolean;
  limit?: number;
  // Matching.
  mode?: MatchingMode;
  reembed?: boolean;
};

// Category names by id, null when the category no longer exists (see lib/job-categories).
export type CategoryNames = ReadonlyMap<number, string | null>;

// The category a job is limited to: `options.category_id`, or the `category` of a price
// refresh when it is an id (it may also be an external id or a URL).
export function jobCategoryId(job: { options?: Record<string, unknown> | null }): number | null {
  const options = job.options ?? {};
  const raw = options.category_id ?? options.category;
  const id = typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : raw;
  return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : null;
}

// "category: Name" of a job limited to a category ("#id" once the category is gone), else null.
export function jobCategoryLabel(job: { options?: Record<string, unknown> | null }, names: CategoryNames): string | null {
  const id = jobCategoryId(job);
  return id === null ? null : `category: ${names.get(id) ?? `#${id}`}`;
}

// Task of a job, with its category when it is limited to one.
export function jobTitle(job: { task: TaskName; options?: Record<string, unknown> | null }, names: CategoryNames): string {
  const category = jobCategoryLabel(job, names);
  return category ? `${TASK_LABELS[job.task]} · ${category}` : TASK_LABELS[job.task];
}

export const TASK_LABELS: Record<TaskName, string> = {
  catalog_sync: "Catalog sync",
  price_refresh: "Price refresh",
  matching: "Matching",
};
