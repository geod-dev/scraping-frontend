"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlayIcon, Settings2Icon } from "lucide-react";
import { toast } from "sonner";
import { startWorker } from "@/app/actions";
import { useConfirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
};

const TASK_NAMES: Record<TaskName, string> = {
  catalog_sync: "catalog sync",
  price_refresh: "price refresh",
  matching: "matching",
};

// Start button of a task, with its options: the matching mode, or a run whose failed pages
// alone a catalog sync refetches. Asks for confirmation, then reports the new job in a toast.
export function StartTaskForm({ competitorKey, competitorName, task, label, disabled, disabledReason, firstMatchingRun }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<MatchingMode>("incremental");
  const [retryRunId, setRetryRunId] = useState("");
  const [confirm, confirmDialog] = useConfirm();
  const busy = disabled || pending;

  async function start() {
    const retryFailedRunId = retryRunId.trim() ? Number(retryRunId) : undefined;
    if (retryFailedRunId !== undefined && (!Number.isInteger(retryFailedRunId) || retryFailedRunId <= 0)) {
      toast.error("Enter a valid run id.");
      return;
    }
    let message: string;
    if (task === "matching") {
      message = firstMatchingRun
        ? "The first run embeds the whole catalog and can take a few minutes. Later runs are faster."
        : "Only changed product texts are embedded again, so this is usually quick.";
    } else {
      message = retryFailedRunId
        ? `Only the failed pages of run #${retryFailedRunId} will be fetched again. This uses scraping credits.`
        : "This uses scraping credits.";
    }
    if (!(await confirm({ title: `Start a ${TASK_NAMES[task]} for ${competitorName}?`, message, confirmLabel: "Start" }))) return;
    startTransition(async () => {
      const result = await startWorker({
        key: competitorKey,
        task,
        mode: task === "matching" ? mode : undefined,
        retryFailedRunId: task === "catalog_sync" ? retryFailedRunId : undefined,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const jobHref = result.redirectTo;
      toast.success(`${label}: job started`, jobHref ? { action: { label: "Open job", onClick: () => router.push(jobHref) } } : undefined);
      router.refresh();
    });
  }

  const button = (
    <Button size="lg" onClick={start} disabled={busy}>
      {pending ? <Spinner /> : <PlayIcon />}
      {pending ? "Starting…" : label}
    </Button>
  );

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
      {task === "matching" ? (
        <div className="space-y-1 md:text-right">
          <ToggleGroup type="single" variant="outline" size="sm" value={mode} onValueChange={(v) => v && setMode(v as MatchingMode)} disabled={busy} aria-label="Matching mode">
            {MATCHING_MODES.map((m) => (
              <ToggleGroupItem key={m.mode} value={m.mode} className="px-2.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                {m.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="max-w-80 text-xs text-muted-foreground">{MATCHING_MODES.find((m) => m.mode === mode)?.description}</p>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        {task === "catalog_sync" ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon-lg" disabled={busy} aria-label="Sync options" title="Options">
                <Settings2Icon />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-2">
              <Label htmlFor={`retry-${competitorKey}`}>Only retry the failed pages of run #</Label>
              <Input
                id={`retry-${competitorKey}`}
                type="number"
                min={1}
                inputMode="numeric"
                value={retryRunId}
                onChange={(e) => setRetryRunId(e.target.value)}
                placeholder="Run id"
              />
              <p className="text-xs text-muted-foreground">Leave empty for a normal full sync.</p>
            </PopoverContent>
          </Popover>
        ) : null}
        {disabled && disabledReason ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>{button}</span>
            </TooltipTrigger>
            <TooltipContent>{disabledReason}</TooltipContent>
          </Tooltip>
        ) : (
          button
        )}
      </div>
      {confirmDialog}
    </div>
  );
}
