"use client";

import { useEffect, useEffectEvent, useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { rejectMatch, resetMatch, validateMatch } from "@/app/actions";
import { DECIDED_EVENT, MILESTONE_EVERY, prefersReducedMotion, recordReview, useReviewerName, type DecidedDetail, type Outcome } from "@/components/review-session";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

type Product = { id: number; title: string };

type Props = {
  productId: number;
  // The engine's proposal (or the current association), if any.
  proposal: Product | null;
  // Already validated: confirming the proposal again is pointless.
  validated: boolean;
  // Antalis product being previewed through the compare endpoint, to associate instead.
  chosen: Product | null;
  hasRejections: boolean;
  // Neighbours in the list the review was opened from, and the position in it.
  prev: { href: string; title: string | null } | null;
  next: { href: string; title: string | null } | null;
  queue: { index: number; total: number } | null;
};

// `manual` = another product than the engine proposal, always confirmed.
type Request =
  | { action: "validate"; target: Product; manual: boolean; withComment: boolean }
  | { action: "reject"; withComment: boolean }
  | { action: "reset" };

type Inputs = { decidedBy?: string; comment?: string; clearRejections?: boolean };

const BURST = {
  validated: { label: "Validated", color: "bg-emerald-600", ripple: "bg-emerald-400" },
  rejected: { label: "Rejected", color: "bg-rose-600", ripple: "bg-rose-400" },
  reset: { label: "Sent back to the engine", color: "bg-slate-700", ripple: "bg-slate-400" },
};

// Decision bar stuck to the bottom of the screen: validate / reject (with a menu for the
// "with comment" variants), send back to the engine, previous / next. Decisions that need it
// are confirmed in a dialog, which also asks the reviewer name the first time (then
// remembered on this browser). Shortcuts: V validate, R reject (arrows: KeyboardNav).
export function DecisionBar({ productId, proposal, validated, chosen, hasRejections, prev, next, queue }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [advance, setAdvance] = useState(true);
  const [dialog, setDialog] = useState<Request | null>(null);
  const [burst, setBurst] = useState<{ outcome: Outcome; milestone: number | null; leaving: boolean } | null>(null);
  const [name, saveName] = useReviewerName();

  const busy = pending || burst !== null;
  // What the main green button validates: the previewed product first, else the proposal.
  const mainTarget: { target: Product; manual: boolean } | null = chosen ? { target: chosen, manual: true } : proposal && !validated ? { target: proposal, manual: false } : null;
  const nextHref = next?.href ?? null;

  function decide(request: Request, inputs: Inputs) {
    const decidedBy = inputs.decidedBy || name || undefined;
    const comment = inputs.comment || undefined;
    const work = (): Promise<ActionResult> =>
      request.action === "validate"
        ? validateMatch({ productId, antalisProductId: request.manual ? request.target.id : undefined, decidedBy, comment })
        : request.action === "reject"
          ? rejectMatch({ productId, decidedBy, comment })
          : resetMatch({ productId, decidedBy, clearRejections: inputs.clearRejections === true });
    const outcome: Outcome = request.action === "validate" ? "validated" : request.action === "reject" ? "rejected" : "reset";

    setError(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const count = outcome === "reset" ? null : recordReview();
      const milestone = count !== null && count % MILESTONE_EVERY === 0 ? count : null;
      const leaving = advance && nextHref !== null;
      setBurst({ outcome, milestone, leaving });
      window.dispatchEvent(new CustomEvent<DecidedDetail>(DECIDED_EVENT, { detail: { outcome, leaving } }));
      // Let the feedback play before moving on; the page remounts this bar on the next product.
      const delay = prefersReducedMotion() ? 150 : milestone ? 1200 : 700;
      window.setTimeout(() => {
        if (leaving && nextHref) {
          router.push(nextHref);
        } else {
          router.refresh();
          window.setTimeout(() => setBurst(null), 400);
        }
      }, delay);
    });
  }

  function askValidate(target: Product, manual: boolean, withComment: boolean) {
    const request: Request = { action: "validate", target, manual, withComment };
    if (!withComment && !manual && name) decide(request, {});
    else setDialog(request);
  }

  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (dialog || busy) return;
    const key = event.key.toLowerCase();
    if (key === "v" && mainTarget) {
      event.preventDefault();
      askValidate(mainTarget.target, mainTarget.manual, false);
    } else if (key === "r") {
      event.preventDefault();
      setDialog({ action: "reject", withComment: false });
    }
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], [role='menu']")) return;
      onShortcut(event);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const validateTitle = mainTarget ? `Associate with "${mainTarget.target.title}"` : validated ? "Already validated" : "Nothing to validate: preview an Antalis product first";
  const progress = queue && queue.total > 0 ? ((queue.index + 1) / queue.total) * 100 : null;

  return (
    <>
      <div
        className={cn(
          "sticky bottom-0 z-20 mt-8 -mb-10 py-3",
          // Full-bleed background behind the bar (the main column clips the overflow).
          "before:absolute before:inset-y-0 before:-inset-x-[100vmax] before:-z-10 before:border-t before:bg-background/95 before:shadow-[0_-6px_16px_-10px_rgb(15_23_42/0.2)] before:backdrop-blur",
        )}
      >
        {error ? (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200" role="alert">
            <span>{error}</span>
            <Button variant="ghost" size="xs" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            {prev || next ? (
              <ButtonGroup>
                <NavButton href={prev?.href ?? null} title={prev?.title ? `Previous: ${prev.title}` : "Previous"} label="Previous" direction="prev" />
                <NavButton href={nextHref} title={next?.title ? `Next: ${next.title}` : "Next"} label="Next" direction="next" />
              </ButtonGroup>
            ) : null}
            <div className="min-w-0 space-y-1 text-xs text-muted-foreground">
              {queue ? (
                <div className="flex items-center gap-2">
                  <span className="tabular-nums">
                    <span className="font-semibold text-foreground">{(queue.index + 1).toLocaleString("en-GB")}</span> of {queue.total.toLocaleString("en-GB")}
                  </span>
                  {progress !== null ? (
                    <span className="h-1 w-16 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(2, progress)}%` }} />
                    </span>
                  ) : null}
                </div>
              ) : null}
              {nextHref ? (
                <Label className="gap-1.5 text-xs font-normal text-muted-foreground">
                  <Checkbox checked={advance} onCheckedChange={(v) => setAdvance(v === true)} />
                  Open the next product after deciding
                </Label>
              ) : null}
              <p className="hidden items-center gap-1 xl:flex">
                <Kbd>V</Kbd> validate · <Kbd>R</Kbd> reject
                {prev || next ? (
                  <>
                    {" "}
                    · <Kbd>←</Kbd> <Kbd>→</Kbd> navigate
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
            <Button variant="outline" className="h-11" disabled={busy} onClick={() => setDialog({ action: "reset" })} title="Recomputed by the next matching run">
              <RotateCcwIcon />
              <span className="hidden sm:inline">Send back to the engine</span>
              <span className="sm:hidden">Send back</span>
            </Button>
            {chosen && proposal && !validated ? (
              <Button
                variant="outline"
                className="h-11 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                disabled={busy}
                title={`Associate with the engine proposal "${proposal.title}"`}
                onClick={() => askValidate(proposal, false, false)}
              >
                Validate the proposal instead
              </Button>
            ) : null}
            <DecisionButton
              tone="danger"
              icon={<XIcon />}
              label="Reject"
              shortcut="R"
              disabled={busy}
              title="No Antalis equivalent: the proposed product is never proposed again"
              onClick={() => setDialog({ action: "reject", withComment: false })}
              menuLabel="More reject options"
              items={[{ label: "Reject with comment…", hint: "Explain why there is no equivalent", onSelect: () => setDialog({ action: "reject", withComment: true }) }]}
            />
            <DecisionButton
              tone="success"
              icon={pending ? <Spinner /> : <CheckIcon />}
              label={chosen ? "Validate the chosen product" : "Validate"}
              shortcut="V"
              disabled={busy || !mainTarget}
              title={validateTitle}
              onClick={() => mainTarget && askValidate(mainTarget.target, mainTarget.manual, false)}
              menuLabel="More validate options"
              items={[
                {
                  label: "Validate with comment…",
                  hint: name ? `Add a note · reviewer: ${name}` : "Add a note and your name",
                  onSelect: () => mainTarget && askValidate(mainTarget.target, mainTarget.manual, true),
                },
              ]}
            />
          </div>
        </div>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => (open ? null : setDialog(null))}>
        <DialogContent className="sm:max-w-md">
          {dialog ? (
            <>
              <DialogHeader>
                <DialogTitle>{dialogTitle(dialog, !name)}</DialogTitle>
                <DialogDescription>{dialogText(dialog, !name)}</DialogDescription>
              </DialogHeader>
              <DecisionForm
                request={dialog}
                name={name}
                askName={!name || (dialog.action !== "reset" && dialog.withComment)}
                hasRejections={hasRejections}
                onCancel={() => setDialog(null)}
                onSubmit={(inputs) => {
                  if (inputs.decidedBy && inputs.decidedBy !== name) saveName(inputs.decidedBy);
                  setDialog(null);
                  decide(dialog, inputs);
                }}
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {burst ? <DecisionBurst outcome={burst.outcome} milestone={burst.milestone} leaving={burst.leaving} /> : null}
    </>
  );
}

const TONES = {
  success: "bg-emerald-600 text-white hover:bg-emerald-500",
  danger: "bg-rose-600 text-white hover:bg-rose-500",
};

// Large solid button with a menu of variants of the same action (e.g. "Validate with comment").
function DecisionButton({
  tone,
  icon,
  label,
  shortcut,
  onClick,
  disabled,
  title,
  items,
  menuLabel,
}: {
  tone: keyof typeof TONES;
  icon: ReactNode;
  label: string;
  shortcut: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  items: { label: string; hint?: string; onSelect: () => void }[];
  menuLabel: string;
}) {
  return (
    <ButtonGroup className="flex-1 sm:flex-none">
      <Button className={cn("h-11 flex-1 px-5 font-semibold", TONES[tone])} onClick={onClick} disabled={disabled} title={title}>
        {icon}
        {label}
        <Kbd className="hidden border-white/30 bg-white/15 text-white md:inline-flex">{shortcut}</Kbd>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className={cn("h-11 w-10 border-l border-white/25", TONES[tone])} disabled={disabled} aria-label={menuLabel}>
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-64">
          {items.map((item) => (
            <DropdownMenuItem key={item.label} onSelect={item.onSelect} className="flex-col items-start gap-0.5">
              <span className="font-medium">{item.label}</span>
              {item.hint ? <span className="text-xs text-muted-foreground">{item.hint}</span> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}

function dialogTitle(request: Request, firstTime: boolean): string {
  if (request.action === "reject") return "Reject: no Antalis equivalent?";
  if (request.action === "reset") return "Send this product back to the engine?";
  if (request.manual) return "Validate with the chosen product?";
  if (request.withComment) return "Validate with a comment";
  return firstTime ? "Who is reviewing?" : "Validate the match";
}

function dialogText(request: Request, firstTime: boolean): ReactNode {
  if (request.action === "reject") return "The proposed product will never be proposed again for this competitor product.";
  if (request.action === "reset") return "It is recomputed by the next matching run.";
  const target = <span className="font-medium text-foreground">“{request.target.title}”</span>;
  if (request.manual) return <>Associate this competitor product with {target}. It is recorded as a manual choice.</>;
  if (!request.withComment && firstTime) return <>Your name is recorded with each decision and remembered on this browser. You can change it later with “Validate with comment”.</>;
  return <>Associate this competitor product with {target}.</>;
}

function DecisionForm({
  request,
  name,
  askName,
  hasRejections,
  onCancel,
  onSubmit,
}: {
  request: Request;
  name: string;
  askName: boolean;
  hasRejections: boolean;
  onCancel: () => void;
  onSubmit: (inputs: Inputs) => void;
}) {
  const withComment = request.action !== "reset" && request.withComment;
  const submitClass = request.action === "validate" ? TONES.success : request.action === "reject" ? TONES.danger : undefined;
  const submitLabel = request.action === "validate" ? "Validate" : request.action === "reject" ? "Reject" : "Send back";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "").trim() || undefined;
    onSubmit({ decidedBy: value("decidedBy") ?? name, comment: value("comment"), clearRejections: data.get("clearRejections") === "on" });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {askName ? (
        <div className="space-y-1.5">
          <Label htmlFor="decided-by">Your name</Label>
          <Input id="decided-by" name="decidedBy" defaultValue={name} placeholder="First and last name" maxLength={100} required autoFocus={!withComment || !name} autoComplete="name" />
        </div>
      ) : null}
      {withComment ? (
        <div className="space-y-1.5">
          <Label htmlFor="decision-comment">Comment</Label>
          <Textarea id="decision-comment" name="comment" placeholder="Why this decision (kept in the history)" maxLength={1000} autoFocus={Boolean(name)} className="h-24" />
        </div>
      ) : null}
      {request.action === "reset" && hasRejections ? (
        <Label className="font-normal">
          <Checkbox name="clearRejections" />
          Also forget the products rejected by reviewers
        </Label>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className={submitClass} autoFocus={!askName && !withComment}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Check / cross that pops in the middle of the screen once a decision is saved.
function DecisionBurst({ outcome, milestone, leaving }: { outcome: Outcome; milestone: number | null; leaving: boolean }) {
  const style = BURST[outcome];
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <span className={cn("review-ripple absolute inset-0 rounded-full", style.ripple)} aria-hidden />
          {milestone ? <span className={cn("review-ripple absolute inset-0 rounded-full [animation-delay:220ms]", style.ripple)} aria-hidden /> : null}
          <span className={cn("review-pop relative flex size-20 items-center justify-center rounded-full text-white shadow-lg", style.color)}>
            {outcome === "validated" ? <CheckIcon className="size-10" strokeWidth={2.5} /> : outcome === "rejected" ? <XIcon className="size-9" strokeWidth={2.5} /> : <RotateCcwIcon className="size-9" strokeWidth={2.2} />}
          </span>
        </div>
        <div className="review-pop rounded-full bg-background px-4 py-1.5 text-center text-sm font-medium shadow-md ring-1 ring-foreground/10">
          {style.label}
          {milestone ? <span className="text-emerald-700"> · {milestone} reviews today</span> : null}
          {leaving ? <span className="font-normal text-muted-foreground"> · opening the next product…</span> : null}
        </div>
      </div>
    </div>
  );
}

function NavButton({ href, title, label, direction }: { href: string | null; title: string; label: string; direction: "prev" | "next" }) {
  const Icon = direction === "prev" ? ChevronLeftIcon : ChevronRightIcon;
  if (!href) {
    return (
      <Button variant="outline" size="icon" className="size-10" disabled title={`No ${label.toLowerCase()} product`}>
        <Icon />
      </Button>
    );
  }
  return (
    <Button variant="outline" size="icon" className="size-10" asChild>
      <Link href={href} title={title} aria-label={label}>
        <Icon />
      </Link>
    </Button>
  );
}
