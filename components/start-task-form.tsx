"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startWorker } from "@/app/actions";
import { inputClass, primaryButton } from "@/components/ui";
import { MATCHING_MODES } from "@/lib/matching";
import type { MatchingMode, TaskName } from "@/lib/types";

type Props = {
  competitorKey: string;
  competitorName: string;
  task: TaskName;
  label: string;
  disabled?: boolean;
  // Why the task cannot start, shown as a tooltip on the disabled button.
  disabledReason?: string | null;
  // Matching only: no product has been matched yet, so the run embeds the whole catalog.
  firstMatchingRun?: boolean;
  // Open the created job instead of refreshing the current page.
  followJob?: boolean;
};

const TASK_NAMES: Record<TaskName, string> = {
  catalog_sync: "catalog sync",
  price_refresh: "price refresh",
  matching: "matching",
};

export function StartTaskForm({ competitorKey, competitorName, task, label, disabled, disabledReason, firstMatchingRun, followJob }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<MatchingMode>("incremental");
  const [retryRunId, setRetryRunId] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const retryFailedRunId = retryRunId.trim() ? Number(retryRunId) : undefined;
    if (retryFailedRunId !== undefined && (!Number.isInteger(retryFailedRunId) || retryFailedRunId <= 0)) {
      setError("Enter a valid run id.");
      return;
    }
    let message = `Start a ${TASK_NAMES[task]} job for ${competitorName}?`;
    if (task === "matching") {
      message += firstMatchingRun
        ? " The first run embeds the whole catalog and can take a few minutes. Later runs are faster."
        : " Only changed product texts are embedded again, so this is usually quick.";
    } else {
      message += retryFailedRunId
        ? ` Only the failed pages of run #${retryFailedRunId} will be fetched again. This will use scraping credits.`
        : " This will use scraping credits.";
    }
    if (!window.confirm(message)) return;
    setError(null);
    startTransition(async () => {
      const result = await startWorker({
        key: competitorKey,
        task,
        mode: task === "matching" ? mode : undefined,
        retryFailedRunId: task === "catalog_sync" ? retryFailedRunId : undefined,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (followJob && result.redirectTo) router.push(result.redirectTo);
      else router.refresh();
    });
  }

  // flex-1 / mt-auto keep the button at the bottom when the form fills a stretched card.
  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-3">
      {task === "matching" ? (
        <fieldset className="space-y-1.5" disabled={disabled || pending}>
          <legend className="text-xs font-medium text-slate-600">Mode</legend>
          {MATCHING_MODES.map((m) => (
            <label key={m.mode} className="flex items-start gap-2 text-sm">
              <input type="radio" name={`mode-${competitorKey}`} value={m.mode} checked={mode === m.mode} onChange={() => setMode(m.mode)} className="mt-1" />
              <span>
                <span className="font-medium text-slate-800">{m.label}</span>
                <span className="block text-xs text-slate-500">{m.description}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {task === "catalog_sync" ? (
        <details className="text-xs text-slate-600">
          <summary className="cursor-pointer select-none">Options</summary>
          <label className="mt-2 flex flex-col gap-1 font-medium">
            Only retry the failed pages of run #
            <input
              className={`${inputClass} w-36`}
              type="number"
              min={1}
              inputMode="numeric"
              value={retryRunId}
              onChange={(e) => setRetryRunId(e.target.value)}
              placeholder="Run id"
              disabled={disabled || pending}
            />
            <span className="font-normal text-slate-500">Leave empty for a normal full sync.</span>
          </label>
        </details>
      ) : null}

      <span className="mt-auto inline-flex flex-col items-start gap-1">
        <button type="submit" className={primaryButton} disabled={disabled || pending} title={disabled ? (disabledReason ?? undefined) : undefined}>
          {pending ? "Starting…" : label}
        </button>
        {error ? <span className="max-w-xs text-xs text-rose-700">{error}</span> : null}
      </span>
    </form>
  );
}
