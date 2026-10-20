import Link from "next/link";
import type { ReactNode } from "react";
import { ProductCell, ScoreGauge, SubScore } from "@/components/matching";
import { Badge } from "@/components/ui";
import { labelize } from "@/lib/format";
import { formatMeasure, formatValue } from "@/lib/matching";
import type { Candidate, Flag } from "@/lib/types";

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

const FEATURE_STYLES = {
  match: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  conflict: "bg-rose-50 text-rose-800 ring-rose-200",
  unknown: "bg-slate-50 text-slate-600 ring-slate-200",
};

function percent(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : `${Math.round(value * 100)}%`;
}

// Score breakdown of one Antalis candidate for a competitor product: final score, the three
// sub-scores with their weights, compared measures, characteristics, exclusions and flags.
// `current` marks the candidate shown in the side-by-side comparison of the review screen.
export function CandidateCard({ candidate: c, action, current }: { candidate: Candidate; action?: ReactNode; current?: boolean }) {
  const differing = new Set(c.differences.map((d) => `${d.kind}:${d.field}`));
  const featureDiffs = c.differences.filter((d) => d.kind === "feature" && !c.features.some((f) => f.key === d.field));

  return (
    <article
      className={cx(
        "rounded-xl border bg-white p-4 shadow-sm",
        current && "ring-2 ring-indigo-500/25",
        c.is_associated ? "border-emerald-300" : c.is_proposed ? "border-indigo-300" : c.excluded ? "border-rose-200" : "border-slate-200",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
            {c.rank ?? "×"}
          </span>
          <div className="min-w-0 space-y-1">
            <ProductCell product={c.antalis_product} />
            <div className="flex flex-wrap gap-1">
              {c.is_associated ? <Badge tone="success">Associated</Badge> : null}
              {c.is_proposed ? <Badge tone="info">Proposed</Badge> : null}
              {c.rejected_by_human ? <Badge tone="danger">Rejected by a reviewer</Badge> : null}
              {c.excluded ? <Badge tone="danger">Excluded</Badge> : null}
              {c.retrieved_by.map((signal) => (
                <Badge key={signal} tone="neutral">
                  found by {signal}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ScoreGauge score={c.score} />
          {action}
        </div>
      </header>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <SubScore label="Semantic" value={c.semantic_score} weight={c.weights.semantic} />
        <SubScore label="Lexical" value={c.lexical_score} weight={c.weights.lexical} />
        <SubScore label="Dimensions" value={c.dimension_score} weight={c.weights.dimensions} />
      </div>

      {c.exclusions.length > 0 ? <FlagList title="Cannot be associated" flags={c.exclusions} tone="danger" /> : null}
      {c.review_flags.length > 0 ? <FlagList title="Prevents an automatic association" flags={c.review_flags} tone="warning" /> : null}

      {c.dimensions.measures.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1 pr-3 font-medium">Measure</th>
                <th className="py-1 pr-3 font-medium">Competitor</th>
                <th className="py-1 pr-3 font-medium">Antalis</th>
                <th className="py-1 pr-3 text-right font-medium">Difference</th>
                <th className="py-1 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {c.dimensions.measures.map((m) => {
                const different = differing.has(`dimension:${m.key}`) || (m.score != null && m.score < 1);
                return (
                  <tr key={m.key} className={different ? "bg-amber-50" : undefined}>
                    <td className="py-1.5 pr-3 text-slate-700">{m.label}</td>
                    <td className="py-1.5 pr-3 tabular-nums text-slate-900" title={m.competitor_source ? `from ${m.competitor_source}` : undefined}>
                      {formatMeasure(m.competitor, m.unit)}
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums text-slate-900" title={m.reference_source ? `from ${m.reference_source}` : undefined}>
                      {formatMeasure(m.reference, m.unit)}
                    </td>
                    <td className={cx("py-1.5 pr-3 text-right tabular-nums", different ? "font-medium text-amber-800" : "text-slate-500")}>
                      {percent(m.relative_difference) ?? "—"}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-slate-600">{m.score != null ? Math.round(m.score * 100) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-400">No measure comparable on both sides.</p>
      )}

      {c.features.length > 0 || featureDiffs.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {c.features.map((f) => (
            <li
              key={f.key}
              className={cx("rounded-md px-2 py-1 text-xs ring-1 ring-inset", FEATURE_STYLES[f.status])}
              title={f.policy ? `Conflict policy: ${f.policy}` : undefined}
            >
              <span className="font-medium">{labelize(f.key)}</span>: {formatValue(f.competitor)}
              {f.status === "match" ? null : <> vs {formatValue(f.reference)}</>}
              {f.status === "conflict" ? " ✕" : f.status === "match" ? " ✓" : " ?"}
            </li>
          ))}
          {featureDiffs.map((d) => (
            <li key={d.field} className={cx("rounded-md px-2 py-1 text-xs ring-1 ring-inset", FEATURE_STYLES.conflict)}>
              <span className="font-medium">{d.label ?? labelize(d.field)}</span>: {formatValue(d.competitor)} vs {formatValue(d.reference)}
            </li>
          ))}
        </ul>
      ) : null}

      {c.lexical.shared_terms && c.lexical.shared_terms.length > 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          <span className="font-medium text-slate-600">Shared terms:</span> {c.lexical.shared_terms.join(", ")}
        </p>
      ) : null}

      <p className="mt-2 text-[11px] text-slate-400">
        Semantic cosine {c.semantic.cosine?.toFixed(3) ?? "—"} · lexical cosine {c.lexical.cosine?.toFixed(3) ?? "—"} ·{" "}
        <Link href={c.antalis_product.url} target="_blank" rel="noreferrer" className="hover:text-slate-600">
          Antalis page ↗
        </Link>
      </p>
    </article>
  );
}

function FlagList({ title, flags, tone }: { title: string; flags: Flag[]; tone: "danger" | "warning" }) {
  return (
    <div
      className={cx(
        "mt-3 rounded-lg border px-3 py-2 text-xs",
        tone === "danger" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-900",
      )}
    >
      <p className="font-medium">{title}</p>
      <ul className="mt-0.5 list-disc pl-4">
        {flags.map((f) => (
          <li key={`${f.code}-${f.field ?? ""}`}>{f.message}</li>
        ))}
      </ul>
    </div>
  );
}
