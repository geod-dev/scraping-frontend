import Link from "next/link";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { StatusBadge, ToneBadge } from "@/components/kit";
import { ProductThumb } from "@/components/product-thumb";
import { formatDateTime, formatNumber } from "@/lib/format";
import { firstImage } from "@/lib/images";
import {
  MATCH_EVENT_LABELS,
  MATCH_STATUSES,
  MATCH_STATUS_DESCRIPTIONS,
  MATCH_STATUS_LABELS,
  decisionReasonLabel,
  formatScore,
  type Thresholds,
} from "@/lib/matching";
import type { MatchEvent, MatchEventKind, MatchStatus, ProductBrief, Reason } from "@/lib/types";

export function MatchStatusBadge({ status, manualChoice }: { status: MatchStatus | null | undefined; manualChoice?: boolean }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1" title={MATCH_STATUS_DESCRIPTIONS[status]}>
      <StatusBadge status={status} label={MATCH_STATUS_LABELS[status]} />
      {manualChoice ? <ToneBadge>Manual choice</ToneBadge> : null}
    </span>
  );
}

// Colour of each match status in charts (same hues as the status badges).
const MATCH_STATUS_COLORS: Record<MatchStatus, string> = {
  needs_review: "bg-amber-400",
  auto_matched: "bg-sky-500",
  validated: "bg-emerald-500",
  no_match: "bg-slate-300",
  rejected: "bg-rose-400",
  deprecated: "bg-violet-400",
};

// How the matches of a competitor split by status: a stacked bar and a legend whose rows
// open the matches of that status.
export function StatusDistribution({ counts, hrefFor, compact }: { counts: Record<string, number>; hrefFor?: (status: MatchStatus) => string; compact?: boolean }) {
  const total = MATCH_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  return (
    <div className="space-y-3">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        {total > 0
          ? MATCH_STATUSES.map((s) => (counts[s] ? <span key={s} className={MATCH_STATUS_COLORS[s]} style={{ width: `${(counts[s] / total) * 100}%` }} /> : null))
          : null}
      </div>
      {compact ? null : (
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
          {MATCH_STATUSES.map((s) => {
            const body = (
              <>
                <span className={cn("size-2 shrink-0 rounded-full", MATCH_STATUS_COLORS[s])} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{MATCH_STATUS_LABELS[s]}</span>
                <span className="font-medium tabular-nums">{formatNumber(counts[s] ?? 0)}</span>
              </>
            );
            return (
              <li key={s}>
                {hrefFor ? (
                  <Link href={hrefFor(s)} className="-mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted" title={MATCH_STATUS_DESCRIPTIONS[s]}>
                    {body}
                  </Link>
                ) : (
                  <span className="flex items-center gap-2 py-1 text-sm">{body}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const RING_RADIUS = 42;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

// Circular gauge of a 0-100 similarity score, the one score visual of the console (lists,
// candidates, review screen). It is not a probability: never render it as a percentage.
// Coloured against the engine thresholds (automatic association / review band); large rings
// also draw the thresholds as ticks. The arc fills on mount (disabled by reduced motion).
export function ScoreRing({ score, thresholds, label, size = 40 }: { score: number | null | undefined; thresholds?: Thresholds; label?: string; size?: number }) {
  const value = score === null || score === undefined ? null : Math.min(100, Math.max(0, score));
  const auto = thresholds?.auto ?? null;
  const review = thresholds?.review ?? null;
  const large = size >= 80;
  const tone =
    value === null
      ? "text-slate-300"
      : auto == null || review == null
        ? "text-primary"
        : value >= auto
          ? "text-emerald-500"
          : value >= review
            ? "text-amber-500"
            : "text-rose-500";
  const ticks = large ? [auto, review].filter((t): t is number => typeof t === "number" && t > 0 && t < 100) : [];
  const stroke = large ? 9 : 11;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title="Similarity score (0-100), not a probability">
      <svg viewBox="0 0 100 100" className="size-full" aria-hidden>
        <circle cx="50" cy="50" r={RING_RADIUS} fill="none" strokeWidth={stroke} className="stroke-muted" />
        {value !== null ? (
          <circle
            cx="50"
            cy="50"
            r={RING_RADIUS}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke="currentColor"
            className={cn("score-ring-arc", tone)}
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
        <span className="font-semibold tracking-tight tabular-nums" style={{ fontSize: Math.max(10, size * (large ? 0.24 : 0.3)) }}>
          {formatScore(value)}
        </span>
        {label && large ? <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span> : null}
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
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="tabular-nums">{scaled === null ? "n/a" : formatScore(scaled)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        {scaled !== null ? <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(100, Math.max(0, scaled))}%` }} /> : null}
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground/80">
        {weight !== undefined ? `weight ${weight.toFixed(2)}` : null}
        {scaled === null ? `${weight !== undefined ? " · " : ""}not comparable` : null}
      </p>
    </div>
  );
}

export function DecisionReasons({ reasons, compact }: { reasons: Reason[]; compact?: boolean }) {
  if (reasons.length === 0) return null;
  if (compact) {
    return <span className="text-xs text-muted-foreground">{reasons.map((r) => decisionReasonLabel(r.code, r.message)).join(" · ")}</span>;
  }
  return (
    <ul className="space-y-1 text-sm">
      {reasons.map((r) => (
        <li key={r.code} className="flex gap-2">
          <span className="text-muted-foreground/60" aria-hidden>
            •
          </span>
          <span>
            <span className="font-medium">{decisionReasonLabel(r.code)}</span>
            {r.message ? <span className="text-muted-foreground"> — {r.message}</span> : null}
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
    <ol className="divide-y">
      {events.map((e) => (
        <li key={e.id} className="flex gap-3 px-5 py-3.5">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-slate-300" aria-hidden />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <ToneBadge tone={EVENT_TONES[e.event]}>{MATCH_EVENT_LABELS[e.event]}</ToneBadge>
              {e.from_status || e.to_status ? (
                <span className="inline-flex items-center gap-1">
                  {e.from_status ? <MatchStatusBadge status={e.from_status} /> : null}
                  {e.from_status && e.to_status ? <span className="text-muted-foreground">→</span> : null}
                  {e.to_status ? <MatchStatusBadge status={e.to_status} /> : null}
                </span>
              ) : null}
              {e.score !== null ? <span className="text-xs text-muted-foreground">score {formatScore(e.score)}</span> : null}
            </div>
            {showProduct ? (
              <p className="text-sm">
                <Link href={`/matching/products/${e.product_id}`} className="font-medium text-primary hover:text-primary/80">
                  {e.product_title ?? `Product #${e.product_id}`}
                </Link>
              </p>
            ) : null}
            {e.from_antalis_product_id || e.to_antalis_product_id ? (
              <p className="text-xs text-muted-foreground">
                Antalis product: <ProductRef id={e.from_antalis_product_id} />
                {" → "}
                <ProductRef id={e.to_antalis_product_id} />
              </p>
            ) : null}
            {e.reason ? <p className="text-sm">{decisionReasonLabel(e.reason, e.reason)}</p> : null}
            <p className="text-xs text-muted-foreground">
              {e.actor} · {formatDateTime(e.created_at)}
              {e.job_id ? (
                <>
                  {" · "}
                  <Link href={`/jobs/${e.job_id}`} className="hover:text-foreground">
                    job #{e.job_id}
                  </Link>
                </>
              ) : null}
            </p>
            {Object.keys(e.data ?? {}).length > 0 ? (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none">Previous state</summary>
                <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted p-2">{JSON.stringify(e.data, null, 2)}</pre>
              </details>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ProductRef({ id }: { id: number | null }) {
  if (!id) return <>none</>;
  return (
    <Link href={`/products/${id}`} className="text-primary hover:text-primary/80">
      #{id}
    </Link>
  );
}

// Product with its image, title, reference and brand. The title links to `href` (the product
// page by default; match lists pass the review screen so a row has a single destination), or
// to nothing with `href={null}`.
export function ProductCell({ product, note, href, image = true }: { product: ProductBrief | null | undefined; note?: string; href?: string | null; image?: boolean }) {
  if (!product) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex min-w-0 max-w-md items-center gap-3 whitespace-normal">
      {image ? <ProductThumb src={product.image_url ?? firstImage(product.images)} /> : null}
      <div className="min-w-0">
        {href === null ? (
          <p className="line-clamp-2 font-medium">{product.title ?? "Untitled product"}</p>
        ) : (
          <Link href={href ?? `/products/${product.id}`} className="line-clamp-2 font-medium text-foreground hover:text-primary">
            {product.title ?? "Untitled product"}
          </Link>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {product.catalog_reference ? <code>{product.catalog_reference}</code> : null}
          {product.brand ? <span>{product.brand}</span> : null}
          {product.status === "missing" ? <ToneBadge tone="danger">Missing</ToneBadge> : null}
          {note ? <span className="italic">{note}</span> : null}
        </div>
      </div>
    </div>
  );
}
