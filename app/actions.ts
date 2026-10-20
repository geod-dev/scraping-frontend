"use server";

import { revalidatePath } from "next/cache";
import { apiFetch, isApiError } from "@/lib/api";
import type { ActionResult } from "@/lib/action-result";
import type { Job, MatchingMode, RerunResult, TaskName } from "@/lib/types";

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
    if (isApiError(error)) return { ok: false, message: error.message };
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

const toJob = (job: Job) => ({ redirectTo: `/jobs/${job.id}` });

export async function startWorker(input: {
  key: string;
  task: TaskName;
  mode?: MatchingMode;
  retryFailedRunId?: number;
}): Promise<ActionResult> {
  if (!KEY_PATTERN.test(input.key)) return { ok: false, message: "Invalid competitor key." };
  let options: Record<string, unknown> = {};
  if (input.task === "matching") {
    if (input.mode && !MODES.includes(input.mode)) return { ok: false, message: "Unknown matching mode." };
    options = { mode: input.mode ?? "incremental" };
  } else if (input.task === "catalog_sync") {
    if (input.retryFailedRunId !== undefined) {
      if (!isPositiveInt(input.retryFailedRunId)) return { ok: false, message: "Invalid run id." };
      options = { retry_failed_run_id: input.retryFailedRunId };
    }
  } else if (input.task !== "price_refresh") {
    return { ok: false, message: "Unknown task." };
  }
  return run(
    () => apiFetch<Job>(`/competitors/${input.key}/worker/start`, { method: "POST", body: { task: input.task, options } }),
    toJob,
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
