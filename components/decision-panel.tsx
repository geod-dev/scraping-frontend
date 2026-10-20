"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rejectMatch, resetMatch, validateMatch } from "@/app/actions";
import { dangerButton, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import type { ActionResult } from "@/lib/action-result";

const DECIDED_BY_KEY = "matching.decidedBy";

type Props = {
  productId: number;
  // Title of the engine's proposal (or of the current association), if any.
  proposalTitle: string | null;
  // Already validated: confirming the proposal again is pointless.
  validated: boolean;
  // Antalis product being previewed through the compare endpoint, to associate instead.
  chosen: { id: number; title: string } | null;
  hasRejections: boolean;
  // Next product of the list the review was opened from.
  nextHref: string | null;
};

export function DecisionPanel({ productId, proposalTitle, validated, chosen, hasRejections, nextHref }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [decidedBy, setDecidedBy] = useState("");
  const [comment, setComment] = useState("");
  const [clearRejections, setClearRejections] = useState(false);
  const [advance, setAdvance] = useState(true);

  // The reviewer name is a per-browser convenience; storage may be unavailable.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DECIDED_BY_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from browser storage
      if (saved) setDecidedBy(saved);
    } catch {}
  }, []);

  function rememberName(value: string) {
    setDecidedBy(value);
    try {
      window.localStorage.setItem(DECIDED_BY_KEY, value);
    } catch {}
  }

  function decide(work: () => Promise<ActionResult>, confirmMessage?: string) {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setError(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setComment("");
      if (advance && nextHref) router.push(nextHref);
      else router.refresh();
    });
  }

  const author = decidedBy.trim() || undefined;
  const note = comment.trim() || undefined;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Decided by
          <input className={inputClass} value={decidedBy} onChange={(e) => rememberName(e.target.value)} placeholder="Your name" maxLength={100} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 sm:col-span-2">
          Comment
          <textarea
            className={`${inputClass} h-20 py-2`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Why this decision (kept in the history)"
            maxLength={1000}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {chosen ? (
          <button
            type="button"
            className={primaryButton}
            disabled={pending}
            onClick={() =>
              decide(
                () => validateMatch({ productId, antalisProductId: chosen.id, decidedBy: author, comment: note }),
                `Associate with "${chosen.title}"?`,
              )
            }
          >
            Validate with the chosen product
          </button>
        ) : null}
        {proposalTitle && !validated ? (
          <button
            type="button"
            className={chosen ? secondaryButton : primaryButton}
            disabled={pending}
            title={`Associate with "${proposalTitle}"`}
            onClick={() => decide(() => validateMatch({ productId, decidedBy: author, comment: note }))}
          >
            Validate the proposal
          </button>
        ) : null}
        <button
          type="button"
          className={dangerButton}
          disabled={pending}
          onClick={() =>
            decide(
              () => rejectMatch({ productId, decidedBy: author, comment: note }),
              "Reject: there is no Antalis equivalent? The proposed product will never be proposed again.",
            )
          }
        >
          Reject: no equivalent
        </button>
        <button
          type="button"
          className={secondaryButton}
          disabled={pending}
          onClick={() =>
            decide(
              () => resetMatch({ productId, decidedBy: author, clearRejections }),
              "Send this product back to the engine? It is recomputed by the next matching run.",
            )
          }
        >
          Send back to the engine
        </button>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
        {hasRejections ? (
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={clearRejections} onChange={(e) => setClearRejections(e.target.checked)} />
            When sending back, forget the products rejected by reviewers
          </label>
        ) : null}
        {nextHref ? (
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={advance} onChange={(e) => setAdvance(e.target.checked)} />
            Open the next product after deciding
          </label>
        ) : null}
      </div>

      {pending ? <p className="text-xs text-slate-500">Saving…</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
