import "server-only";

import { cache } from "react";
import { apiFetch } from "@/lib/api";
import { jobCategoryId, type CategoryNames } from "@/lib/tasks";
import type { Category, Job } from "@/lib/types";

// Name of a category, null when it no longer exists (banned or deleted since the job ran).
const categoryName = cache(async (id: number): Promise<string | null> => {
  try {
    return (await apiFetch<Category>(`/categories/${id}`)).name;
  } catch {
    return null;
  }
});

// Names of the categories the given jobs are limited to, by category id.
export async function jobCategoryNames(jobs: (Pick<Job, "options"> | null | undefined)[]): Promise<CategoryNames> {
  const ids = [...new Set(jobs.map((job) => (job ? jobCategoryId(job) : null)).filter((id): id is number => id !== null))];
  const names = await Promise.all(ids.map(categoryName));
  return new Map(ids.map((id, i) => [id, names[i]]));
}
