import Link from "next/link";
import type { ReactNode } from "react";
import { labelize } from "@/lib/format";
import { buildQuery, type QueryValues } from "@/lib/params";

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description ? <div className="mt-1 text-sm text-slate-500">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cx("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title ? <h2 className="text-sm font-semibold text-slate-900">{title}</h2> : null}
            {description ? <div className="mt-0.5 text-xs text-slate-500">{description}</div> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className={padded ? "p-5" : undefined}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  tone?: "default" | "warning" | "success";
}) {
  const body = (
    <div
      className={cx(
        "rounded-xl border bg-white p-5 shadow-sm transition",
        tone === "warning" && "border-amber-200",
        tone === "success" && "border-emerald-200",
        tone === "default" && "border-slate-200",
        href && "hover:border-indigo-300 hover:shadow",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

const BADGE_TONES: Record<string, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};

const STATUS_TONES: Record<string, keyof typeof BADGE_TONES> = {
  // jobs & runs
  queued: "info",
  running: "info",
  paused: "warning",
  pausing: "warning",
  resuming: "info",
  stopping: "warning",
  succeeded: "success",
  success: "success",
  partial: "warning",
  failed: "danger",
  error: "danger",
  cancelled: "neutral",
  aborted: "neutral",
  interrupted: "warning",
  idle: "neutral",
  // catalog
  active: "success",
  missing: "danger",
  // items
  not_found: "warning",
  no_price: "warning",
  skipped: "neutral",
  // matching
  auto_matched: "info",
  validated: "success",
  needs_review: "warning",
  no_match: "neutral",
  rejected: "danger",
  deprecated: "violet",
  // notifications
  info: "info",
  warning: "warning",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof BADGE_TONES }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        BADGE_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  const tone = (status && STATUS_TONES[status]) || "neutral";
  const pulsing = status === "running";
  return (
    <Badge tone={tone}>
      {pulsing ? <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden /> : null}
      {label ?? labelize(status)}
    </Badge>
  );
}

export function ProgressBar({ value, tone = "indigo" }: { value: number | null | undefined; tone?: "indigo" | "emerald" | "amber" }) {
  const pct = Math.min(100, Math.max(0, Math.round(value ?? 0)));
  const bar = { indigo: "bg-indigo-500", emerald: "bg-emerald-500", amber: "bg-amber-500" }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx("h-full rounded-full transition-all duration-500", bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function DefinitionList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</dt>
          <dd className="mt-1 break-words text-sm text-slate-900">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-x-auto", className)}>
      <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, align = "left" }: { children?: ReactNode; align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={cx(
        "bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className,
}: {
  children?: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td className={cx("px-4 py-3 align-middle text-slate-700", align === "right" && "text-right tabular-nums", className)}>
      {children}
    </td>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {children ? <div className="max-w-md text-sm text-slate-500">{children}</div> : null}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "danger"; children: ReactNode }) {
  const styles = {
    info: "border-sky-200 bg-sky-50 text-sky-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-rose-200 bg-rose-50 text-rose-800",
  }[tone];
  return <div className={cx("rounded-lg border px-4 py-3 text-sm", styles)}>{children}</div>;
}

export function Pagination({
  basePath,
  query,
  total,
  limit,
  offset,
}: {
  basePath: string;
  query: QueryValues;
  total: number;
  limit: number;
  offset: number;
}) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  const href = (nextOffset: number) => {
    const qs = buildQuery({ ...query, offset: nextOffset > 0 ? String(nextOffset) : undefined });
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const linkClass =
    "rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50";
  return (
    <nav className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-600" aria-label="Pagination">
      <span>
        Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        {offset > 0 ? (
          <Link className={linkClass} href={href(Math.max(0, offset - limit))}>
            Previous
          </Link>
        ) : (
          <span className="rounded-md border border-slate-100 px-3 py-1.5 text-slate-300">Previous</span>
        )}
        {offset + limit < total ? (
          <Link className={linkClass} href={href(offset + limit)}>
            Next
          </Link>
        ) : (
          <span className="rounded-md border border-slate-100 px-3 py-1.5 text-slate-300">Next</span>
        )}
      </div>
    </nav>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <form className="mb-5 flex flex-wrap items-end gap-3" method="get">{children}</form>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-medium text-slate-600">
      {label}
      {children}
    </label>
  );
}

export const inputClass =
  "h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

export const buttonClass =
  "inline-flex h-9 items-center justify-center rounded-md px-3.5 text-sm font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50";

export const primaryButton = `${buttonClass} bg-indigo-600 text-white hover:bg-indigo-500`;
export const secondaryButton = `${buttonClass} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
export const dangerButton = `${buttonClass} border border-rose-200 bg-white text-rose-700 hover:bg-rose-50`;

export function ApiUnavailable({ message }: { message: string }) {
  return (
    <Notice tone="danger">
      <p className="font-medium">Could not load data</p>
      <p className="mt-1 text-rose-700/90">{message}</p>
    </Notice>
  );
}

// Solid variants for decisive actions (validate / reject).
export const successButton = `${buttonClass} bg-emerald-600 text-white hover:bg-emerald-500`;
export const solidDangerButton = `${buttonClass} bg-rose-600 text-white hover:bg-rose-500`;
