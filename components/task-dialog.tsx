"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, FolderTreeIcon, PlayIcon } from "lucide-react";
import { toast } from "sonner";
import { estimateTask, loadCategoryOptions, startWorker } from "@/app/actions";
import { CategoryPicker } from "@/components/category-picker";
import { EstimateLine } from "@/components/job-progress";
import { ActionErrorNotice, Notice } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CategoryOption } from "@/lib/categories";
import { MATCHING_MODES } from "@/lib/matching";
import { TASK_LABELS, type TaskOptions } from "@/lib/tasks";
import type { Estimate, MatchingMode, TaskName } from "@/lib/types";

// Start dialog of a job: its scope (whole catalog, one category, failed pages of a run), the
// options of the task, and a live estimate of what it costs. Starting reports the new job in
// a toast; a refusal (worker busy...) stays in the dialog with a link to the blocking job.

type Scope = "all" | "category" | "retry";

export type TaskDialogProps = {
  competitorKey: string;
  competitorName: string;
  task: TaskName;
  // The job is limited to this category and its sub-categories (no scope choice).
  category?: { id: number; name: string };
  // Matching only: no product has been matched yet, so the run embeds the whole catalog.
  firstMatchingRun?: boolean;
};

const TITLES: Record<TaskName, string> = {
  catalog_sync: "Sync the catalog",
  price_refresh: "Refresh prices",
  matching: "Match with Antalis",
};

const DESCRIPTIONS: Record<TaskName, string> = {
  catalog_sync: "Discovers categories and products across the site, with their details and prices. Uses scraping credits.",
  price_refresh: "Re-reads the prices and details of products already in the catalog, from their product pages. Uses scraping credits.",
  matching: "Associates each product with its Antalis equivalent. No web page is fetched; new product texts are embedded (Voyage AI).",
};

const SCOPE_HINTS: Record<TaskName, Partial<Record<Scope, string>>> = {
  catalog_sync: {
    all: "A full sync: products no longer listed on the site are flagged missing.",
    category: "Crawls the category and its whole subtree, even when it is empty here. Never a full sync: nothing is flagged missing.",
    retry: "Only the pages that failed in that run: its failed product pages and failed listing pages with their sub-pages.",
  },
  price_refresh: {
    all: "Every active product of the competitor.",
    category: "Only the products of the category and its sub-categories.",
    retry: "Only the products that failed in that run.",
  },
  matching: {
    all: "Every product of the competitor, against the whole Antalis catalog.",
    category: "Only the products of the category and its sub-categories, against the whole Antalis catalog.",
  },
};

const ESTIMATE_DELAY_MS = 400;

// Empty field: undefined; otherwise a non-negative number, or NaN when it is not one.
function numberField(value: string, integer = true): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && (!integer || Number.isInteger(n)) ? n : Number.NaN;
}

export function TaskDialog({
  open,
  onOpenChange,
  competitorKey,
  competitorName,
  task,
  category,
  firstMatchingRun,
}: TaskDialogProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scope, setScope] = useState<Scope>(category ? "category" : "all");
  const [categoryId, setCategoryId] = useState<number | null>(category?.id ?? null);
  const [categories, setCategories] = useState<CategoryOption[] | null>(null);
  const [retryRunId, setRetryRunId] = useState("");
  const [mode, setMode] = useState<MatchingMode>("incremental");
  const [reembed, setReembed] = useState(false);
  const [maxProducts, setMaxProducts] = useState("");
  const [skipProducts, setSkipProducts] = useState(false);
  const [resumeWithinHours, setResumeWithinHours] = useState("");
  const [skipFreshHours, setSkipFreshHours] = useState("");
  const [limit, setLimit] = useState("");
  const [updateDetails, setUpdateDetails] = useState(true);
  const [includeMissing, setIncludeMissing] = useState(false);
  const [estimate, setEstimate] = useState<{ key: string; data: Estimate | null; error: string | null } | null>(null);
  const [error, setError] = useState<{ message: string; jobId?: number } | null>(null);
  const requestId = useRef(0);

  const scopes: { value: Scope; label: string }[] = [
    { value: "all", label: "Whole catalog" },
    { value: "category", label: "One category" },
    ...(task === "matching" ? [] : [{ value: "retry" as const, label: "Failed pages of a run" }]),
  ];

  // The options, or what is wrong with the form.
  function readOptions(): { options: TaskOptions } | { invalid: string } {
    const options: TaskOptions = {};
    if (scope === "category") {
      if (!categoryId) return { invalid: "Choose a category." };
      options.categoryId = categoryId;
    }
    if (scope === "retry") {
      const run = numberField(retryRunId);
      if (!run) return { invalid: "Enter the id of the run to retry." };
      options.retryFailedRunId = run;
      return { options };
    }
    if (task === "matching") return { options: { ...options, mode, reembed } };
    const numbers =
      task === "catalog_sync"
        ? { maxProducts: numberField(maxProducts), resumeWithinHours: numberField(resumeWithinHours, false) }
        : { limit: numberField(limit), skipFreshHours: numberField(skipFreshHours, false) };
    if (Object.values(numbers).some((n) => Number.isNaN(n))) return { invalid: "Advanced options: enter positive numbers or leave the fields empty." };
    if (task === "price_refresh" && numbers.limit === 0) return { invalid: "Advanced options: the number of products must be at least 1." };
    return task === "catalog_sync" ? { options: { ...options, ...numbers, skipProducts } } : { options: { ...options, ...numbers, updateDetails, includeMissing } };
  }

  const read = readOptions();
  const optionsKey = JSON.stringify(read);

  // Categories of the picker, loaded the first time the scope needs them.
  useEffect(() => {
    if (!open || scope !== "category" || category || categories !== null) return;
    let cancelled = false;
    loadCategoryOptions({ key: competitorKey }).then((result) => {
      if (!cancelled) setCategories(result.ok ? (result.data ?? []) : []);
    });
    return () => {
      cancelled = true;
    };
  }, [open, scope, category, categories, competitorKey]);

  // Estimate of the current options, once the user pauses. Only the latest request counts.
  useEffect(() => {
    if (!open) return;
    const current = JSON.parse(optionsKey) as ReturnType<typeof readOptions>;
    const id = ++requestId.current;
    if ("invalid" in current) return;
    const timer = window.setTimeout(async () => {
      const result = await estimateTask({ key: competitorKey, task, options: current.options });
      if (id !== requestId.current) return;
      setEstimate(result.ok ? { key: optionsKey, data: result.data ?? null, error: null } : { key: optionsKey, data: null, error: result.message });
    }, ESTIMATE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [open, optionsKey, competitorKey, task]);
  // The estimate shown belongs to the current options; otherwise it is on its way.
  const shownEstimate = estimate?.key === optionsKey ? estimate : null;
  const estimating = !("invalid" in read) && shownEstimate === null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ("invalid" in read) {
      setError({ message: read.invalid });
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await startWorker({ key: competitorKey, task, options: read.options });
      if (!result.ok) {
        setError({ message: result.message, jobId: result.jobId });
        return;
      }
      onOpenChange(false);
      const jobHref = result.redirectTo;
      const where = category?.name ?? (scope === "category" ? categories?.find((c) => c.value === String(categoryId))?.label : null);
      toast.success(`${TASK_LABELS[task]} started${where ? ` · ${where}` : ""}`, jobHref ? { action: { label: "Open job", onClick: () => router.push(jobHref) } } : undefined);
      router.refresh();
    });
  }

  const hint = SCOPE_HINTS[task][scope];
  const unknownSize = scope === "category" && shownEstimate?.data && shownEstimate.data.products == null && task !== "matching";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {TITLES[task]} · {competitorName}
          </DialogTitle>
          <DialogDescription>{DESCRIPTIONS[task]}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <Field label="Scope" hint={hint}>
            {category ? (
              <p className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                <FolderTreeIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate font-medium">{category.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">and its sub-categories</span>
              </p>
            ) : (
              <div className="space-y-2">
                <ToggleGroup type="single" variant="outline" size="sm" value={scope} onValueChange={(v) => v && setScope(v as Scope)} aria-label="Scope" className="flex-wrap">
                  {scopes.map((s) => (
                    <ToggleGroupItem key={s.value} value={s.value} className="px-2.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                      {s.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                {scope === "category" ? <CategoryPicker options={categories} value={categoryId} onChange={setCategoryId} /> : null}
                {scope === "retry" ? (
                  <Input type="number" min={1} inputMode="numeric" value={retryRunId} onChange={(e) => setRetryRunId(e.target.value)} placeholder="Run id, e.g. 42" aria-label="Run to retry" />
                ) : null}
              </div>
            )}
          </Field>

          {task === "matching" ? (
            <Field label="Mode" hint={MATCHING_MODES.find((m) => m.mode === mode)?.description}>
              <ToggleGroup type="single" variant="outline" size="sm" value={mode} onValueChange={(v) => v && setMode(v as MatchingMode)} aria-label="Matching mode">
                {MATCHING_MODES.map((m) => (
                  <ToggleGroupItem key={m.mode} value={m.mode} className="px-2.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                    {m.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
          ) : null}

          {scope !== "retry" ? (
            <Collapsible className="rounded-lg border">
              <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2 text-sm font-medium">
                Advanced options
                <ChevronDownIcon className="size-4 text-muted-foreground transition group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 border-t px-3 py-3">
                {task === "catalog_sync" ? (
                  <>
                    <NumberField id="resume-hours" label="Do not refetch products synced less than … hours ago" value={resumeWithinHours} onChange={setResumeWithinHours} placeholder="48" hint="0 refetches every product." step="any" />
                    <NumberField id="max-products" label="Stop after … products" value={maxProducts} onChange={setMaxProducts} placeholder="All" />
                    <CheckField id="skip-products" checked={skipProducts} onChange={setSkipProducts} label="Only discover categories and product URLs (no product page)" />
                    {scope === "all" && (maxProducts.trim() !== "" || skipProducts) ? (
                      <p className="text-xs text-amber-700">With a limit the sync is partial: nothing is flagged missing.</p>
                    ) : null}
                  </>
                ) : null}
                {task === "price_refresh" ? (
                  <>
                    <NumberField id="skip-fresh" label="Skip products priced less than … hours ago" value={skipFreshHours} onChange={setSkipFreshHours} placeholder="None" step="any" />
                    <NumberField id="limit" label="At most … products" value={limit} onChange={setLimit} placeholder="All" />
                    <CheckField id="update-details" checked={updateDetails} onChange={setUpdateDetails} label="Also re-read descriptions, characteristics and images (no extra request)" />
                    <CheckField id="include-missing" checked={includeMissing} onChange={setIncludeMissing} label="Include the products flagged missing" />
                  </>
                ) : null}
                {task === "matching" ? (
                  <>
                    <CheckField id="reembed" checked={reembed} onChange={setReembed} label="Embed every text of the run again, replacing the cached vectors" />
                    {reembed ? <p className="text-xs text-amber-700">Paid and normally never needed: cached texts are reused otherwise.</p> : null}
                  </>
                ) : null}
              </CollapsibleContent>
            </Collapsible>
          ) : null}

          <div className="min-h-9 rounded-lg bg-muted/50 px-3 py-2" aria-live="polite">
            {estimating ? (
              <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner /> Estimating…
              </p>
            ) : shownEstimate?.error ? (
              <p className="text-xs text-muted-foreground">No estimate: {shownEstimate.error}</p>
            ) : shownEstimate?.data ? (
              <>
                <EstimateLine estimate={shownEstimate.data} />
                {unknownSize ? <p className="mt-0.5 text-xs text-muted-foreground">Size unknown: the category has no products here yet.</p> : null}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">{"invalid" in read ? read.invalid : "No estimate available."}</p>
            )}
          </div>

          {task === "matching" && firstMatchingRun && scope === "all" ? (
            <Notice tone="warning">The first run embeds the whole catalog and can take a few minutes. Later runs are faster.</Notice>
          ) : null}

          {error ? (
            <ActionErrorNotice title="The job was not started" error={error} />
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || "invalid" in read}>
              {pending ? <Spinner /> : <PlayIcon />}
              {pending ? "Starting…" : "Start"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Button opening the start dialog; disabled with a tooltip giving the reason.
export function StartTaskButton({
  label,
  icon,
  disabled,
  disabledReason,
  variant = "default",
  ...dialog
}: TaskDialogProps & {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  disabledReason?: string | null;
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const button = (
    <Button size="lg" variant={variant} onClick={() => setOpen(true)} disabled={disabled}>
      {icon ?? <PlayIcon />}
      {label}
    </Button>
  );
  return (
    <>
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
      {/* Mounted while open only: every opening starts from the default options. */}
      {open ? <TaskDialog open={open} onOpenChange={setOpen} {...dialog} /> : null}
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  step,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  step?: string;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-center sm:gap-3">
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
      <Input id={id} type="number" min={0} step={step} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {hint ? <p className="text-xs text-muted-foreground sm:col-span-2">{hint}</p> : null}
    </div>
  );
}

function CheckField({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <Label htmlFor={id} className="font-normal leading-snug">
        {label}
      </Label>
    </div>
  );
}
