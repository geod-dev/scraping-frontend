"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rerunDeprecated } from "@/app/actions";
import { primaryButton } from "@/components/ui";
import type { RerunResult } from "@/lib/types";

// Queues one "obsolete only" matching job per competitor having obsolete matches, then
// reports what was started, refused and skipped.
export function RerunDeprecatedButton({ competitor, disabled }: { competitor?: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RerunResult | null>(null);

  function run() {
    const scope = competitor ? `for ${competitor}` : "for every competitor";
    if (!window.confirm(`Recompute all obsolete matches ${scope}?`)) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      const response = await rerunDeprecated({ competitor });
      if (!response.ok) {
        setError(response.message);
        return;
      }
      setResult(response.data ?? null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button type="button" className={primaryButton} onClick={run} disabled={disabled || pending}>
        {pending ? "Starting…" : "Rerun all obsolete"}
      </button>
      {error ? <span className="max-w-xs text-xs text-rose-700">{error}</span> : null}
      {result ? (
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-3 text-left text-xs text-slate-700 shadow-sm" role="status">
          {result.jobs.length > 0 ? (
            <p>
              <span className="font-medium text-emerald-700">Started:</span>{" "}
              {result.jobs.map((job, i) => (
                <span key={job.id}>
                  {i > 0 ? ", " : null}
                  <Link href={`/jobs/${job.id}`} className="text-indigo-600 hover:text-indigo-500">
                    #{job.id} ({job.competitor_key})
                  </Link>
                </span>
              ))}
            </p>
          ) : (
            <p className="font-medium text-slate-600">No job started.</p>
          )}
          {result.refused.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5">
              {result.refused.map((r) => (
                <li key={r.competitor_key}>
                  <span className="font-medium text-amber-800">Refused · {r.competitor_key}:</span> {r.message}
                </li>
              ))}
            </ul>
          ) : null}
          {result.nothing_to_do.length > 0 ? (
            <p className="mt-1.5 text-slate-500">Nothing to do: {result.nothing_to_do.join(", ")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
