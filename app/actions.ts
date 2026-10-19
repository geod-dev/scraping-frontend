"use server";

import { revalidatePath } from "next/cache";
import { apiFetch, isApiError } from "@/lib/api";
import type { ActionResult } from "@/lib/action-result";
import type { MatchStatus, TaskName } from "@/lib/types";

// Server actions run on the server only. Each one validates its input, calls the
// scraper API with the server-side key, and returns a result the UI can display.

const KEY_PATTERN = /^[a-z0-9_-]{1,64}$/;

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

async function run(work: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await work();
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    if (isApiError(error)) return { ok: false, message: error.message };
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export async function startWorker(input: { key: string; task: TaskName }): Promise<ActionResult> {
  if (!KEY_PATTERN.test(input.key)) return { ok: false, message: "Invalid competitor key." };
  if (input.task !== "catalog_sync" && input.task !== "price_refresh") {
    return { ok: false, message: "Unknown task." };
  }
  return run(() =>
    apiFetch(`/competitors/${input.key}/worker/start`, {
      method: "POST",
      body: { task: input.task, options: {} },
    }),
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

export async function deleteJob(input: { id: number }): Promise<ActionResult> {
  if (!isPositiveInt(input.id)) return { ok: false, message: "Invalid job id." };
  return run(() => apiFetch(`/jobs/${input.id}`, { method: "DELETE" }));
}

export async function setMatchStatus(input: { id: number; status: MatchStatus }): Promise<ActionResult> {
  if (!isPositiveInt(input.id)) return { ok: false, message: "Invalid match id." };
  if (!["proposed", "validated", "rejected"].includes(input.status)) {
    return { ok: false, message: "Invalid status." };
  }
  return run(() =>
    apiFetch(`/product-matches/${input.id}`, {
      method: "PATCH",
      body: { status: input.status, validated_by: "dashboard" },
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
