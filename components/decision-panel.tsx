"use client";

import { useEffect, useEffectEvent, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { rejectMatch, resetMatch, validateMatch } from "@/app/actions";
import { Modal } from "@/components/modal";
import {
  DECIDED_EVENT,
  MILESTONE_EVERY,
  prefersReducedMotion,
  recordReview,
  useReviewerName,
  type DecidedDetail,
  type Outcome,
} from "@/components/review-session";
import { SplitButton } from "@/components/split-button";
import { inputClass, primaryButton, secondaryButton, solidDangerButton, successButton } from "@/components/ui";
import type { ActionResult } from "@/lib/action-result";

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

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

// `target` undefined = the engine proposal; otherwise a manual choice, always confirmed.
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

const bigSecondary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

// Decision bar fixed at the bottom of the viewport: validate / reject (with a drop-up for the
// "with comment" variants), send back to the engine, previous / next. Decisions that need it
// are confirmed in a modal, which also asks the reviewer name the first time (then remembered
// on this browser). Shortcuts: V validate, R reject (arrows are handled by KeyboardNav).
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
  const mainTarget: { target: Product; manual: boolean } | null = chosen
    ? { target: chosen, manual: true }
    : proposal && !validated
      ? { target: proposal, manual: false }
      : null;
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

  function askReject(withComment: boolean) {
    setDialog({ action: "reject", withComment });
  }

  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (dialog || busy) return;
    const key = event.key.toLowerCase();
    if (key === "v" && mainTarget) {
      event.preventDefault();
      askValidate(mainTarget.target, mainTarget.manual, false);
    } else if (key === "r") {
      event.preventDefault();
      askReject(false);
    }
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], dialog")) return;
      onShortcut(event);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const validateTitle = mainTarget
    ? `Associate with "${mainTarget.target.title}"`
    : validated
      ? "Already validated"
      : "Nothing to validate: preview an Antalis product first";
  const progress = queue && queue.total > 0 ? ((queue.index + 1) / queue.total) * 100 : null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-[0_-4px_16px_-6px_rgb(15_23_42/0.12)] backdrop-blur lg:left-60">
        {error ? (
          <div className="flex items-start justify-between gap-3 border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800 sm:px-6 lg:px-8" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="shrink-0 text-xs font-medium text-rose-700 hover:text-rose-900">
              Dismiss
            </button>
          </div>
        ) : null}
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {prev || next ? (
              <div className="flex items-center gap-1">
                <NavButton href={prev?.href ?? null} title={prev?.title ? `Previous: ${prev.title}` : "Previous"} label="Previous" direction="prev" />
                <NavButton href={nextHref} title={next?.title ? `Next: ${next.title}` : "Next"} label="Next" direction="next" />
              </div>
            ) : null}
            <div className="min-w-0 space-y-1 text-xs text-slate-500">
              {queue ? (
                <div className="flex items-center gap-2">
                  <span className="tabular-nums">
                    <span className="font-semibold text-slate-900">{(queue.index + 1).toLocaleString("en-US")}</span> of{" "}
                    {queue.total.toLocaleString("en-US")}
                  </span>
                  {progress !== null ? (
                    <span className="h-1 w-16 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                      <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(2, progress)}%` }} />
                    </span>
                  ) : null}
                </div>
              ) : null}
              {nextHref ? (
                <label className="inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={advance} onChange={(e) => setAdvance(e.target.checked)} />
                  Open the next product after deciding
                </label>
              ) : null}
              {pending ? <p className="font-medium text-slate-700">Saving…</p> : null}
              <p className="hidden xl:block">
                <Kbd>V</Kbd> validate · <Kbd>R</Kbd> reject{prev || next ? <> · <Kbd>←</Kbd> <Kbd>→</Kbd> navigate</> : null}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
            <button type="button" className={bigSecondary} disabled={busy} onClick={() => setDialog({ action: "reset" })} title="Recomputed by the next matching run">
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 text-slate-500" aria-hidden>
                <path fillRule="evenodd" d="M15.31 4.69a7 7 0 1 0 1.65 7.3.75.75 0 1 0-1.42-.5 5.5 5.5 0 1 1-1.3-5.74L12.5 7.5h4V3.5l-1.19 1.19Z" clipRule="evenodd" />
              </svg>
              <span className="hidden sm:inline">Send back to the engine</span>
              <span className="sm:hidden">Send back</span>
            </button>
            {chosen && proposal && !validated ? (
              <button
                type="button"
                className={cx(bigSecondary, "border-emerald-300 text-emerald-800 hover:bg-emerald-50")}
                disabled={busy}
                title={`Associate with the engine proposal "${proposal.title}"`}
                onClick={() => askValidate(proposal, false, false)}
              >
                Validate the proposal instead
              </button>
            ) : null}
            <SplitButton
              tone="danger"
              label="Reject"
              shortcut="R"
              disabled={busy}
              title="No Antalis equivalent: the proposed product is never proposed again"
              onClick={() => askReject(false)}
              menuLabel="More reject options"
              items={[{ label: "Reject with comment…", hint: "Explain why there is no equivalent", onSelect: () => askReject(true), disabled: busy }]}
            />
            <SplitButton
              tone="success"
              label={
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden>
                    <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4l3.3 3.29 7.3-7.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
                  </svg>
                  {chosen ? "Validate the chosen product" : "Validate"}
                </>
              }
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
                  disabled: busy || !mainTarget,
                },
              ]}
            />
          </div>
        </div>
      </div>

      <Modal open={dialog !== null} onClose={() => setDialog(null)} title={dialog ? dialogTitle(dialog, !name) : ""} description={dialog ? dialogText(dialog, !name) : null}>
        {dialog ? (
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
        ) : null}
      </Modal>

      {burst ? <DecisionBurst outcome={burst.outcome} milestone={burst.milestone} leaving={burst.leaving} /> : null}
    </>
  );
}

function dialogTitle(request: Request, firstTime: boolean): string {
  if (request.action === "reject") return "Reject: no Antalis equivalent?";
  if (request.action === "reset") return "Send this product back to the engine?";
  if (request.manual) return "Validate with the chosen product?";
  if (request.withComment) return "Validate with a comment";
  return firstTime ? "Who is reviewing?" : "Validate the match";
}

function dialogText(request: Request, firstTime: boolean) {
  if (request.action === "reject") return "The proposed product will never be proposed again for this competitor product.";
  if (request.action === "reset") return "It is recomputed by the next matching run.";
  const target = <span className="font-medium text-slate-900">“{request.target.title}”</span>;
  if (request.manual) return <>Associate this competitor product with {target}. It is recorded as a manual choice.</>;
  if (!request.withComment && firstTime) {
    return <>Your name is recorded with each decision and remembered on this browser. You can change it later with “Validate with comment”.</>;
  }
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
  const tone = request.action === "validate" ? successButton : request.action === "reject" ? solidDangerButton : primaryButton;
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
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Your name
          <input
            className={inputClass}
            name="decidedBy"
            defaultValue={name}
            placeholder="First and last name"
            maxLength={100}
            required
            data-autofocus={!withComment || !name ? true : undefined}
            autoComplete="name"
          />
        </label>
      ) : null}
      {withComment ? (
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Comment
          <textarea
            className={`${inputClass} h-24 py-2`}
            name="comment"
            placeholder="Why this decision (kept in the history)"
            maxLength={1000}
            data-autofocus={name ? true : undefined}
          />
        </label>
      ) : null}
      {request.action === "reset" && hasRejections ? (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="clearRejections" />
          Also forget the products rejected by reviewers
        </label>
      ) : null}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className={secondaryButton} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={tone} data-autofocus={!askName && !withComment ? true : undefined}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

// Check / cross that pops in the middle of the screen once a decision is saved.
function DecisionBurst({ outcome, milestone, leaving }: { outcome: Outcome; milestone: number | null; leaving: boolean }) {
  const style = BURST[outcome];
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center lg:pl-60" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <span className={cx("review-ripple absolute inset-0 rounded-full", style.ripple)} aria-hidden />
          {milestone ? <span className={cx("review-ripple absolute inset-0 rounded-full [animation-delay:220ms]", style.ripple)} aria-hidden /> : null}
          <span className={cx("review-pop relative flex size-20 items-center justify-center rounded-full text-white shadow-lg", style.color)}>
            {outcome === "validated" ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-10" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            ) : outcome === "rejected" ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="size-9" aria-hidden>
                <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-9" aria-hidden>
                <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" />
                <path d="M4.5 4.5V9H9" />
              </svg>
            )}
          </span>
        </div>
        <div className="review-pop rounded-full bg-white px-4 py-1.5 text-center text-sm font-medium text-slate-800 shadow-md ring-1 ring-slate-200">
          {style.label}
          {milestone ? <span className="text-emerald-700"> · {milestone} reviews today</span> : null}
          {leaving ? <span className="font-normal text-slate-500"> · opening the next product…</span> : null}
        </div>
      </div>
    </div>
  );
}

function NavButton({ href, title, label, direction }: { href: string | null; title: string; label: string; direction: "prev" | "next" }) {
  const icon = (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden>
      {direction === "prev" ? (
        <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.83 10l3.94 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clipRule="evenodd" />
      ) : (
        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.17 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
      )}
    </svg>
  );
  const className = "inline-flex size-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition";
  if (!href) {
    return (
      <span className={cx(className, "cursor-not-allowed opacity-40")} aria-disabled title={`No ${label.toLowerCase()} product`}>
        {icon}
      </span>
    );
  }
  return (
    <Link href={href} className={cx(className, "hover:bg-slate-50")} title={title} aria-label={label}>
      {icon}
    </Link>
  );
}

function Kbd({ children }: { children: string }) {
  return <kbd className="rounded border border-slate-300 bg-slate-50 px-1 font-sans text-[11px] font-medium text-slate-600">{children}</kbd>;
}
