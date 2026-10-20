import Link from "next/link";
import type { CSSProperties } from "react";
import { Badge, StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { MATCH_EVENT_LABELS, MATCH_STATUS_DESCRIPTIONS, MATCH_STATUS_LABELS, decisionReasonLabel, formatScore } from "@/lib/matching";
import type { MatchEvent, MatchEventKind, MatchStatus, ProductBrief, Reason } from "@/lib/types";

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

const TABS = [
  { href: "/matching", label: "Overview" },
  { href: "/matching/review", label: "Review queue" },
  { href: "/matching/matches", label: "All matches" },
  { href: "/matching/deprecated", label: "Obsolete" },
  { href: "/matching/history", label: "History" },
];

export function MatchingTabs({ active }: { active: string }) {
  return (
    <nav aria-label="Matching" className="-mt-4 mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === active ? "page" : undefined}
          className={cx(
            "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition",
            tab.href === active ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-900",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function MatchStatusBadge({ status, manualChoice }: { status: MatchStatus | null | undefined; manualChoice?: boolean }) {
  if (!status) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1" title={MATCH_STATUS_DESCRIPTIONS[status]}>
      <StatusBadge status={status} label={MATCH_STATUS_LABELS[status]} />
      {manualChoice ? <Badge tone="neutral">Manual choice</Badge> : null}
    </span>
  );
}

// A similarity score on a 0-100 scale. It is not a probability: never render it as a percentage.
export function ScoreGauge({ score, className }: { score: number | null | undefined; className?: string }) {
  if (score === null || score === undefined) return <span className="text-xs text-slate-400">—</span>;
  const width = Math.min(100, Math.max(0, score));
  return (
    <span className={cx("inline-flex items-center gap-2", className)} title="Similarity score (0-100), not a probability">
      <span className="w-9 text-right text-sm font-semibold tabular-nums text-slate-900">{formatScore(score)}</span>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${width}%` }} />
      </span>
      <span className="sr-only">Similarity score {formatScore(score)} out of 100</span>
    </span>
  );
}

const RING_RADIUS = 42;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

// Large circular gauge of a 0-100 similarity score, coloured against the engine thresholds
// (automatic association / review band), which are drawn as ticks on the ring. The arc fills on
// mount through a CSS animation (disabled by prefers-reduced-motion).
export function ScoreRing({
  score,
  auto,
  review,
  label,
  size = 128,
}: {
  score: number | null | undefined;
  auto?: number | null;
  review?: number | null;
  label?: string;
  size?: number;
}) {
  const value = score === null || score === undefined ? null : Math.min(100, Math.max(0, score));
  const tone =
    value === null
      ? "text-slate-300"
      : auto == null || review == null
        ? "text-indigo-500"
        : value >= auto
          ? "text-emerald-500"
          : value >= review
            ? "text-amber-500"
            : "text-rose-500";
  const ticks = [auto, review].filter((t): t is number => typeof t === "number" && t > 0 && t < 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title="Similarity score (0-100), not a probability">
      <svg viewBox="0 0 100 100" className="size-full" aria-hidden>
        <circle cx="50" cy="50" r={RING_RADIUS} fill="none" strokeWidth="9" className="stroke-slate-100" />
        {value !== null ? (
          <circle
            cx="50"
            cy="50"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            stroke="currentColor"
            className={cx("score-ring-arc", tone)}
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - value / 100)}
            transform="rotate(-90 50 50)"
            style={{ "--ring-length": RING_LENGTH } as CSSProperties}
          />
        ) : null}
        {ticks.map((t) => (
          <line
            key={t}
            x1="50"
            y1={50 - RING_RADIUS - 6.5}
            x2="50"
            y2={50 - RING_RADIUS + 6.5}
            strokeWidth="1.5"
            className="stroke-slate-400"
            transform={`rotate(${(t / 100) * 360} 50 50)`}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="fade-up text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{formatScore(value)}</span>
        {label ? <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span> : null}
      </div>
      <span className="sr-only">
        {label ?? "Score"} {formatScore(value)} out of 100
      </span>
    </div>
  );
}

// Sub-scores come as 0..1 and are shown on the 0-100 scale of the final score.
export function SubScore({ label, value, weight }: { label: string; value: number | null | undefined; weight?: number }) {
  const scaled = value === null || value === undefined ? null : value * 100;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="tabular-nums text-slate-900">{scaled === null ? "n/a" : formatScore(scaled)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        {scaled !== null ? <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(100, Math.max(0, scaled))}%` }} /> : null}
      </div>
      <p className="mt-0.5 text-[11px] text-slate-400">
        {weight !== undefined ? `weight ${weight.toFixed(2)}` : null}
        {scaled === null ? `${weight !== undefined ? " · " : ""}not comparable` : null}
      </p>
    </div>
  );
}

export function DecisionReasons({ reasons, compact }: { reasons: Reason[]; compact?: boolean }) {
  if (reasons.length === 0) return null;
  if (compact) {
    return (
      <span className="text-xs text-slate-500">{reasons.map((r) => decisionReasonLabel(r.code, r.message)).join(" · ")}</span>
    );
  }
  return (
    <ul className="space-y-1 text-sm">
      {reasons.map((r) => (
        <li key={r.code} className="flex gap-2">
          <span className="text-slate-400" aria-hidden>
            •
          </span>
          <span>
            <span className="font-medium text-slate-800">{decisionReasonLabel(r.code)}</span>
            {r.message ? <span className="text-slate-500"> — {r.message}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

const EVENT_TONES: Record<MatchEventKind, "neutral" | "info" | "success" | "danger" | "violet"> = {
  computed: "info",
  recomputed: "info",
  validated: "success",
  rejected: "danger",
  deprecated: "violet",
  reset: "neutral",
};

// Timeline of match events, newest first. `showProduct` adds the product (global history).
export function MatchEventList({ events, showProduct }: { events: MatchEvent[]; showProduct?: boolean }) {
  return (
    <ol className="divide-y divide-slate-100">
      {events.map((e) => (
        <li key={e.id} className="flex gap-3 px-5 py-3.5">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-slate-300" aria-hidden />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={EVENT_TONES[e.event]}>{MATCH_EVENT_LABELS[e.event]}</Badge>
              {e.from_status || e.to_status ? (
                <span className="inline-flex items-center gap-1">
                  {e.from_status ? <MatchStatusBadge status={e.from_status} /> : null}
                  {e.from_status && e.to_status ? <span className="text-slate-400">→</span> : null}
                  {e.to_status ? <MatchStatusBadge status={e.to_status} /> : null}
                </span>
              ) : null}
              {e.score !== null ? <span className="text-xs text-slate-500">score {formatScore(e.score)}</span> : null}
            </div>
            {showProduct ? (
              <p className="text-sm">
                <Link href={`/matching/products/${e.product_id}`} className="font-medium text-indigo-600 hover:text-indigo-500">
                  {e.product_title ?? `Product #${e.product_id}`}
                </Link>
              </p>
            ) : null}
            {e.from_antalis_product_id || e.to_antalis_product_id ? (
              <p className="text-xs text-slate-600">
                Antalis product:{" "}
                {e.from_antalis_product_id ? (
                  <Link href={`/products/${e.from_antalis_product_id}`} className="text-indigo-600 hover:text-indigo-500">
                    #{e.from_antalis_product_id}
                  </Link>
                ) : (
                  "none"
                )}
                {" → "}
                {e.to_antalis_product_id ? (
                  <Link href={`/products/${e.to_antalis_product_id}`} className="text-indigo-600 hover:text-indigo-500">
                    #{e.to_antalis_product_id}
                  </Link>
                ) : (
                  "none"
                )}
              </p>
            ) : null}
            {e.reason ? <p className="text-sm text-slate-700">{decisionReasonLabel(e.reason, e.reason)}</p> : null}
            <p className="text-xs text-slate-400">
              {e.actor} · {formatDateTime(e.created_at)}
              {e.job_id ? (
                <>
                  {" · "}
                  <Link href={`/jobs/${e.job_id}`} className="hover:text-slate-700">
                    job #{e.job_id}
                  </Link>
                </>
              ) : null}
            </p>
            {Object.keys(e.data ?? {}).length > 0 ? (
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer select-none">Previous state</summary>
                <pre className="mt-1 max-h-48 overflow-auto rounded bg-slate-50 p-2">{JSON.stringify(e.data, null, 2)}</pre>
              </details>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ProductCell({ product, note }: { product: ProductBrief | null | undefined; note?: string }) {
  if (!product) return <span className="text-xs text-slate-400">—</span>;
  return (
    <div className="min-w-0 max-w-sm">
      <Link href={`/products/${product.id}`} className="line-clamp-2 font-medium text-indigo-600 hover:text-indigo-500">
        {product.title ?? "Untitled product"}
      </Link>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
        {product.catalog_reference ? <code>{product.catalog_reference}</code> : null}
        {product.brand ? <span>{product.brand}</span> : null}
        {product.status === "missing" ? <Badge tone="danger">Missing</Badge> : null}
        {note ? <span className="italic text-slate-400">{note}</span> : null}
      </div>
    </div>
  );
}
