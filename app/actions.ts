"use server";

import { revalidatePath } from "next/cache";
import { apiFetch, isApiError } from "@/lib/api";
import type { ActionResult } from "@/lib/action-result";
import { categoryOptions, type CategoryOption } from "@/lib/categories";
import type { TaskOptions } from "@/lib/tasks";
import type { BannedCategory, Estimate, Job, MatchingMode, RerunResult, TaskName, UnbanResult } from "@/lib/types";

// Server actions run on the server only. Each one validates its input, calls the
// scraper API with the server-side key, and returns a result the UI can display.

const KEY_PATTERN = /^[a-z0-9_-]{1,64}$/;
const MODES: readonly MatchingMode[] = ["incremental", "deprecated", "all"];

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

// Free text kept in the matching history; trimmed and bounded.
function note(value: string | undefined, max = 1000): string | undefined {
  const trimmed = value?.trim().slice(0, max);
  return trimmed ? trimmed : undefined;
}

async function run<T, R = undefined>(
  work: () => Promise<T>,
  after?: (data: T) => { data?: R; redirectTo?: string },
): Promise<ActionResult<R>> {
  try {
    const data = await work();
    revalidatePath("/", "layout");
    return { ok: true, ...after?.(data) };
  } catch (error) {
    return failure(error);
  }
}

// The API message, and the job that blocks the request when the API names one (worker_busy...).
function failure(error: unknown): { ok: false; message: string; jobId?: number } {
  if (!isApiError(error)) return { ok: false, message: "Something went wrong. Please try again." };
  const jobId = error.details.job_id;
  return { ok: false, message: error.message, jobId: isPositiveInt(jobId) ? jobId : undefined };
}

const toJob = (job: Job) => ({ redirectTo: `/jobs/${job.id}` });

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isHours = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 24 * 365;

// The API options of a task from the dialog's options, or why they are invalid. Only the
// options of the task are kept; a category and a run to retry exclude each other.
function taskOptions(task: TaskName, o: TaskOptions): { options: Record<string, unknown> } | { error: string } {
  if (o.categoryId !== undefined && !isPositiveInt(o.categoryId)) return { error: "Invalid category." };
  if (o.retryFailedRunId !== undefined && !isPositiveInt(o.retryFailedRunId)) return { error: "Invalid run id." };
  if (o.categoryId !== undefined && o.retryFailedRunId !== undefined) return { error: "Choose either a category or a run to retry." };
  if (task === "catalog_sync") {
    if (o.maxProducts !== undefined && !isCount(o.maxProducts)) return { error: "Invalid number of products." };
    if (o.resumeWithinHours !== undefined && !isHours(o.resumeWithinHours)) return { error: "Invalid number of hours." };
    return {
      options: {
        category_id: o.categoryId,
        retry_failed_run_id: o.retryFailedRunId,
        max_products: o.maxProducts,
        skip_products: o.skipProducts === true ? true : undefined,
        resume_within_hours: o.resumeWithinHours,
      },
    };
  }
  if (task === "price_refresh") {
    if (o.limit !== undefined && !isPositiveInt(o.limit)) return { error: "Invalid number of products." };
    if (o.skipFreshHours !== undefined && !isHours(o.skipFreshHours)) return { error: "Invalid number of hours." };
    return {
      options: {
        category: o.categoryId !== undefined ? String(o.categoryId) : undefined,
        retry_failed_run_id: o.retryFailedRunId,
        skip_fresh_hours: o.skipFreshHours,
        include_missing: o.includeMissing === true ? true : undefined,
        update_details: o.updateDetails === false ? false : undefined,
        limit: o.limit,
      },
    };
  }
  if (task === "matching") {
    if (o.mode && !MODES.includes(o.mode)) return { error: "Unknown matching mode." };
    if (o.retryFailedRunId !== undefined) return { error: "A matching run has no failed pages to retry." };
    return { options: { mode: o.mode ?? "incremental", reembed: o.reembed === true ? true : undefined, category_id: o.categoryId } };
  }
  return { error: "Unknown task." };
}

export async function startWorker(input: { key: string; task: TaskName; options?: TaskOptions }): Promise<ActionResult> {
  if (!KEY_PATTERN.test(input.key)) return { ok: false, message: "Invalid competitor key." };
  const built = taskOptions(input.task, input.options ?? {});
  if ("error" in built) return { ok: false, message: built.error };
  return run(
    () => apiFetch<Job>(`/competitors/${input.key}/worker/start`, { method: "POST", body: { task: input.task, options: built.options } }),
    toJob,
  );
}

// What a job with these options would cost, without starting it.
export async function estimateTask(input: { key: string; task: TaskName; options?: TaskOptions }): Promise<ActionResult<Estimate>> {
  if (!KEY_PATTERN.test(input.key)) return { ok: false, message: "Invalid competitor key." };
  const built = taskOptions(input.task, input.options ?? {});
  if ("error" in built) return { ok: false, message: built.error };
  try {
    const estimate = await apiFetch<Estimate>(`/competitors/${input.key}/worker/estimate`, { method: "POST", body: { task: input.task, options: built.options } });
    return { ok: true, data: estimate };
  } catch (error) {
    return failure(error);
  }
}

// The category tree of a competitor as picker options, loaded when a job dialog opens.
export async function loadCategoryOptions(input: { key: string }): Promise<ActionResult<CategoryOption[]>> {
  if (!KEY_PATTERN.test(input.key)) return { ok: false, message: "Invalid competitor key." };
  return { ok: true, data: await categoryOptions(input.key) };
}

// Deletes the category with its whole subtree; every later catalog sync skips it.
export async function banCategory(input: { id: number; reason?: string; bannedBy?: string }): Promise<ActionResult<BannedCategory>> {
  if (!isPositiveInt(input.id)) return { ok: false, message: "Invalid category id." };
  return run(
    () => apiFetch<BannedCategory>(`/categories/${input.id}/ban`, { method: "POST", body: { reason: note(input.reason), banned_by: note(input.bannedBy, 100) } }),
    (data) => ({ data }),
  );
}

// Recreates the category, empty and under a new id; `scrape` also queues its catalog sync
// (if that is refused, nothing is unbanned).
export async function unbanCategory(input: { banId: number; scrape: boolean; unbannedBy?: string }): Promise<ActionResult<UnbanResult>> {
  if (!isPositiveInt(input.banId)) return { ok: false, message: "Invalid ban id." };
  return run(
    () =>
      apiFetch<UnbanResult>(`/categories/banned/${input.banId}/unban`, {
        method: "POST",
        body: { scrape: input.scrape === true, unbanned_by: note(input.unbannedBy, 100) },
      }),
    (data) => ({ data }),
  );
}

export async function workerControl(input: { key: string; action: "pause" | "resume" | "stop" }): Promise<ActionResult> {
  if (!KEY_PATTERN.test(input.key)) return { ok: false, message: "Invalid competitor key." };
  return run(() => apiFetch(`/competitors/${input.key}/worker/${input.action}`, { method: "POST" }));
}

export async function jobControl(input: { id: number; action: "pause" | "resume" | "cancel" }): Promise<ActionResult> {
  if (!isPositiveInt(input.id)) return { ok: false, message: "Invalid job id." };
  return run(() => apiFetch(`/jobs/${input.id}/${input.action}`, { method: "POST" }));
}

export async function restartJob(input: { id: number }): Promise<ActionResult> {
  if (!isPositiveInt(input.id)) return { ok: false, message: "Invalid job id." };
  return run(() => apiFetch<Job>(`/jobs/${input.id}/restart`, { method: "POST" }), toJob);
}

export async function deleteJob(input: { id: number }): Promise<ActionResult> {
  if (!isPositiveInt(input.id)) return { ok: false, message: "Invalid job id." };
  return run(() => apiFetch(`/jobs/${input.id}`, { method: "DELETE" }));
}

export async function retryFailedRun(input: { id: number }): Promise<ActionResult> {
  if (!isPositiveInt(input.id)) return { ok: false, message: "Invalid run id." };
  return run(() => apiFetch<Job>(`/runs/${input.id}/retry-failed`, { method: "POST" }), toJob);
}

export async function rerunDeprecated(input: { competitor?: string }): Promise<ActionResult<RerunResult>> {
  if (input.competitor && !KEY_PATTERN.test(input.competitor)) return { ok: false, message: "Invalid competitor key." };
  return run(
    () => apiFetch<RerunResult>("/matching/deprecated/rerun", { method: "POST", body: input.competitor ? { competitor: input.competitor } : {} }),
    (data) => ({ data }),
  );
}

export async function validateMatch(input: {
  productId: number;
  antalisProductId?: number;
  decidedBy?: string;
  comment?: string;
}): Promise<ActionResult> {
  if (!isPositiveInt(input.productId)) return { ok: false, message: "Invalid product id." };
  if (input.antalisProductId !== undefined && !isPositiveInt(input.antalisProductId)) {
    return { ok: false, message: "Invalid Antalis product id." };
  }
  return run(() =>
    apiFetch(`/matching/products/${input.productId}/validate`, {
      method: "POST",
      body: { antalis_product_id: input.antalisProductId, decided_by: note(input.decidedBy, 100), comment: note(input.comment) },
    }),
  );
}

export async function rejectMatch(input: { productId: number; decidedBy?: string; comment?: string }): Promise<ActionResult> {
  if (!isPositiveInt(input.productId)) return { ok: false, message: "Invalid product id." };
  return run(() =>
    apiFetch(`/matching/products/${input.productId}/reject`, {
      method: "POST",
      body: { decided_by: note(input.decidedBy, 100), comment: note(input.comment) },
    }),
  );
}

export async function resetMatch(input: { productId: number; decidedBy?: string; clearRejections?: boolean }): Promise<ActionResult> {
  if (!isPositiveInt(input.productId)) return { ok: false, message: "Invalid product id." };
  return run(() =>
    apiFetch(`/matching/products/${input.productId}/reset`, {
      method: "POST",
      body: { decided_by: note(input.decidedBy, 100), clear_rejections: input.clearRejections === true },
    }),
  );
}

export async function setNotificationRead(input: { id: number; read: boolean }): Promise<ActionResult> {
  if (!isPositiveInt(input.id)) return { ok: false, message: "Invalid notification id." };
  return run(() => apiFetch(`/notifications/${input.id}/${input.read ? "read" : "unread"}`, { method: "POST" }));
}

export async function markAllNotificationsRead(input: { competitor?: string }): Promise<ActionResult> {
  if (input.competitor && !KEY_PATTERN.test(input.competitor)) {
    return { ok: false, message: "Invalid competitor key." };
  }
  return run(() =>
    apiFetch("/notifications/read-all", {
      method: "POST",
      query: { competitor: input.competitor },
    }),
  );
}
