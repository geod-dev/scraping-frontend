import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightIcon, CircleAlertIcon, InfoIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { StickyHeader } from "@/components/sticky-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { formatNumber, labelize } from "@/lib/format";
import { buildQuery, type QueryValues } from "@/lib/params";
import type { Chip } from "@/lib/filter-chips";

// Page-level building blocks of the console, composed from the shadcn/ui primitives.

export type Crumb = { label: string; href?: string };

function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex min-w-0 flex-wrap items-center gap-1 text-sm text-muted-foreground", className)}>
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1">
          {i > 0 ? <ChevronRightIcon className="size-3.5 text-muted-foreground/50" aria-hidden /> : null}
          {item.href ? (
            <Link href={item.href} className="truncate hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className="truncate text-foreground/80">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

// Sticky page header. Once the page scrolls it condenses: breadcrumbs, description and tabs
// fold away, the title shrinks, while the actions and the toolbar (filters) stay at hand.
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  tabs,
  toolbar,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
  tabs?: ReactNode;
  toolbar?: ReactNode;
}) {
  return (
    <StickyHeader>
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} className="mb-2 group-data-[condensed=true]/header:hidden" /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between group-data-[condensed=true]/header:sm:items-center">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight transition-all group-data-[condensed=true]/header:text-lg">{title}</h1>
          {description ? <div className="mt-1 text-sm text-muted-foreground group-data-[condensed=true]/header:hidden">{description}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {tabs ? <div className="mt-4 group-data-[condensed=true]/header:hidden">{tabs}</div> : null}
      {toolbar ? <div className="mt-4 group-data-[condensed=true]/header:mt-2.5">{toolbar}</div> : null}
    </StickyHeader>
  );
}

// Tabs between sibling pages (links, not in-page panels).
export function LinkTabs({ items, active, label }: { items: { href: string; label: string; count?: number | null }[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto border-b">
      {items.map((tab) => {
        const current = tab.href === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition",
              current ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.count ? (
              <Badge variant={current ? "default" : "secondary"} className="h-4 px-1.5 text-[11px] tabular-nums">
                {formatNumber(tab.count)}
              </Badge>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

// Titled card. `flush` drops the content padding (tables, lists running edge to edge).
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  flush = false,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <Card className={cn(flush && "gap-0 pb-0", className)}>
      {title || actions ? (
        <CardHeader className={cn(flush && "border-b pb-4")}>
          {title ? <CardTitle className="text-sm font-semibold">{title}</CardTitle> : null}
          {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
          {actions ? <CardAction>{actions}</CardAction> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn(flush && "px-0")}>{children}</CardContent>
    </Card>
  );
}

// Link in a panel header ("All jobs →").
export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-primary hover:text-primary/80">
      {children}
      <ChevronRightIcon className="size-4" aria-hidden />
    </Link>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = "default",
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  tone?: "default" | "warning" | "success" | "danger";
  // Optional visual under the value (meter, distribution bar).
  children?: ReactNode;
}) {
  const body = (
    <Card
      className={cn(
        "h-full gap-0 px-5 py-4 transition",
        tone === "warning" && "bg-amber-50/50 ring-amber-200",
        tone === "success" && "ring-emerald-200",
        tone === "danger" && "bg-rose-50/50 ring-rose-200",
        href && "hover:shadow-md hover:ring-primary/30",
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {children ? <div className="mt-3">{children}</div> : null}
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

const TONE_CLASSES = {
  neutral: "bg-slate-100 text-slate-700",
  info: "bg-sky-100 text-sky-800",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-rose-100 text-rose-800",
  violet: "bg-violet-100 text-violet-800",
};

export type Tone = keyof typeof TONE_CLASSES;

const STATUS_TONES: Record<string, Tone> = {
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
  done: "success",
  pending: "neutral",
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

function statusTone(status: string | null | undefined): Tone {
  return (status && STATUS_TONES[status]) || "neutral";
}

export function ToneBadge({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <Badge variant="secondary" className={cn(TONE_CLASSES[tone], className)}>
      {children}
    </Badge>
  );
}

const LIVE_STATUSES = new Set(["running", "queued", "resuming"]);

export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  return (
    <ToneBadge tone={statusTone(status)}>
      {status && LIVE_STATUSES.has(status) ? <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden /> : null}
      {label ?? labelize(status)}
    </ToneBadge>
  );
}

const BAR_TONES = { primary: "bg-primary", emerald: "bg-emerald-500", amber: "bg-amber-500", rose: "bg-rose-500" };

export function ProgressBar({ value, tone = "primary", size = "md" }: { value: number | null | undefined; tone?: keyof typeof BAR_TONES; size?: "sm" | "md" }) {
  const pct = Math.min(100, Math.max(0, Math.round(value ?? 0)));
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-muted", size === "sm" ? "h-1.5" : "h-2")} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all duration-500", BAR_TONES[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function DefinitionList({ items, columns = 2 }: { items: { label: string; value: ReactNode }[]; columns?: 1 | 2 | 3 | 4 }) {
  const grid = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns];
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-4", grid)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 break-words text-sm">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function plainValue(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return <span className="tabular-nums">{formatNumber(value)}</span>;
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((v) => typeof v !== "object" || v === null)) return value.join(", ") || <span className="text-muted-foreground">—</span>;
  return <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 text-left text-xs">{JSON.stringify(value, null, 2)}</pre>;
}

// Readable view of a free-form object (counters, options, parameters): one row per key.
export function KeyValueList({ data, empty = "Nothing recorded." }: { data: Record<string, unknown> | null | undefined; empty?: string }) {
  const entries = Object.entries(data ?? {});
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <dl className="divide-y text-sm">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-start justify-between gap-4 py-2 first:pt-0 last:pb-0">
          <dt className="shrink-0 text-muted-foreground">{labelize(key)}</dt>
          <dd className="min-w-0 break-words text-right">{plainValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

// Trailing cell of a clickable row: a chevron hinting that the row opens a page.
export function RowChevron() {
  return (
    <td className="w-8 pr-3 text-muted-foreground/40" aria-hidden>
      <ChevronRightIcon className="size-4" />
    </td>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Empty className="py-12">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {children ? <EmptyDescription>{children}</EmptyDescription> : null}
      </EmptyHeader>
    </Empty>
  );
}

const NOTICE_STYLES = {
  info: { className: "border-sky-200 bg-sky-50 text-sky-900 *:data-[slot=alert-description]:text-sky-800", icon: InfoIcon },
  warning: { className: "border-amber-200 bg-amber-50 text-amber-900 *:data-[slot=alert-description]:text-amber-800", icon: TriangleAlertIcon },
  danger: { className: "border-rose-200 bg-rose-50 text-rose-900 *:data-[slot=alert-description]:text-rose-800", icon: CircleAlertIcon },
};

export function Notice({ tone = "info", title, children }: { tone?: keyof typeof NOTICE_STYLES; title?: ReactNode; children?: ReactNode }) {
  const { className, icon: Icon } = NOTICE_STYLES[tone];
  return (
    <Alert className={className}>
      <Icon />
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      {children ? <AlertDescription>{children}</AlertDescription> : null}
    </Alert>
  );
}

export function ApiUnavailable({ message }: { message: string }) {
  return (
    <Notice tone="danger" title="Could not load data">
      {message}
    </Notice>
  );
}

export function Pagination({ basePath, query, total, limit, offset }: { basePath: string; query: QueryValues; total: number; limit: number; offset: number }) {
  if (total <= limit) return null;
  const href = (nextOffset: number) => {
    const qs = buildQuery({ ...query, offset: nextOffset > 0 ? String(nextOffset) : undefined });
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const button = buttonVariants({ variant: "outline", size: "lg" });
  return (
    <nav className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground" aria-label="Pagination">
      <span className="tabular-nums">
        <span className="font-medium text-foreground">
          {formatNumber(offset + 1)}–{formatNumber(Math.min(offset + limit, total))}
        </span>{" "}
        of {formatNumber(total)}
      </span>
      <div className="flex gap-2">
        {offset > 0 ? (
          <Link className={button} href={href(Math.max(0, offset - limit))}>
            Previous
          </Link>
        ) : (
          <span className={cn(button, "pointer-events-none opacity-40")}>Previous</span>
        )}
        {offset + limit < total ? (
          <Link className={button} href={href(offset + limit)}>
            Next
          </Link>
        ) : (
          <span className={cn(button, "pointer-events-none opacity-40")}>Next</span>
        )}
      </div>
    </nav>
  );
}

// Active filters as removable chips, followed by "Clear all".
export function FilterChips({ chips, clearHref }: { chips: Chip[]; clearHref: string }) {
  if (chips.length === 0) return null;
  return (
    <>
      {chips.map((chip) => (
        <Badge key={chip.key} variant="outline" asChild className="h-7 max-w-64 gap-1 border-primary/30 bg-primary/5 pr-1.5 pl-2.5 text-primary hover:bg-primary/10">
          <Link href={chip.href} scroll={false} title="Remove this filter">
            <span className="truncate">{chip.label}</span>
            <XIcon className="opacity-60" aria-hidden />
            <span className="sr-only">(remove)</span>
          </Link>
        </Badge>
      ))}
      {chips.length > 1 ? (
        <Link href={clearHref} scroll={false} className="px-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          Clear all
        </Link>
      ) : null}
    </>
  );
}
