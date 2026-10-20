import Link from "next/link";
import type { ReactNode } from "react";
import { ImageGallery } from "@/components/image-gallery";
import { ReadMore } from "@/components/read-more";
import { Badge } from "@/components/ui";
import { formatPrice, labelize } from "@/lib/format";
import { formatMeasure, formatValue } from "@/lib/matching";
import type { Candidate, PriceSummary, ProductBrief, ProductDetail, ProductStatus } from "@/lib/types";

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

// One side of the review comparison, built from the full product when it loaded, else from
// the brief carried by the match.
export type CompareSide = {
  id: number;
  title: string | null;
  brand: string | null;
  reference: string | null;
  slug: string | null;
  url: string;
  status: ProductStatus;
  category: string[];
  images: string[];
  description: string | null;
  attributes: Record<string, unknown>;
  price: PriceSummary | null;
  origin: { name: string; siteUrl: string | null };
  // Set when the full product could not be loaded: only the brief is shown.
  partial: boolean;
};

function imageUrl(item: unknown): string | null {
  if (typeof item === "string") return item.startsWith("http") ? item : null;
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    for (const key of ["url", "src", "href"]) {
      const value = record[key];
      if (typeof value === "string" && value.startsWith("http")) return value;
    }
  }
  return null;
}

// Last path segment of the product URL, without a page extension.
function slugOf(url: string): string | null {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).at(-1);
    return last ? decodeURIComponent(last).replace(/\.(html?|php|aspx?)$/i, "") : null;
  } catch {
    return null;
  }
}

export function toSide(detail: ProductDetail | null, brief: ProductBrief | null, origin: CompareSide["origin"]): CompareSide | null {
  const base = detail ?? brief;
  if (!base) return null;
  return {
    id: base.id,
    title: base.title,
    brand: base.brand,
    reference: base.catalog_reference,
    slug: slugOf(base.url),
    url: base.url,
    status: base.status,
    category: detail ? detail.category_path.map((c) => c.name) : brief?.category ? [brief.category] : [],
    images: [...new Set((detail?.images ?? []).map(imageUrl).filter((u): u is string => Boolean(u)))],
    description: detail ? detail.description || detail.long_description : null,
    attributes: (base.normalized_attributes ?? {}) as Record<string, unknown>,
    price: detail?.latest_price ?? null,
    origin,
    partial: !detail,
  };
}

type Status = "match" | "conflict" | "blocking" | "unknown" | "same" | "differs" | "one_side";

const STATUS_STYLES: Record<Status, { row: string; chip: string; label: string; icon: string }> = {
  match: { row: "bg-emerald-50/60", chip: "bg-emerald-100 text-emerald-800", label: "Match", icon: "✓" },
  conflict: { row: "bg-amber-50/80", chip: "bg-amber-100 text-amber-900", label: "Differs", icon: "≠" },
  blocking: { row: "bg-rose-50/80", chip: "bg-rose-100 text-rose-800", label: "Incompatible", icon: "✕" },
  unknown: { row: "", chip: "bg-slate-100 text-slate-600", label: "Unknown", icon: "?" },
  same: { row: "", chip: "bg-emerald-50 text-emerald-700", label: "Same", icon: "=" },
  differs: { row: "", chip: "bg-slate-100 text-slate-600", label: "Different", icon: "≠" },
  one_side: { row: "", chip: "", label: "", icon: "" },
};

type Check = { key: string; label: string; competitor: string; reference: string; status: Status; note?: string };

// What the engine compared for this pair: measures, characteristics and differences, with
// their verdict. Fields of a certain incompatibility (exclusion) are flagged as blocking.
function engineChecks(c: Candidate): Check[] {
  const differing = new Set(c.differences.map((d) => `${d.kind}:${d.field}`));
  const blockingFields = new Set(c.exclusions.map((f) => f.field).filter(Boolean));
  const checks: Check[] = c.dimensions.measures.map((m) => {
    const different = differing.has(`dimension:${m.key}`) || (m.score != null && m.score < 1);
    const status: Status = blockingFields.has(m.key) ? "blocking" : m.score == null ? "unknown" : different ? "conflict" : "match";
    return {
      key: m.key,
      label: m.label,
      competitor: formatMeasure(m.competitor, m.unit),
      reference: formatMeasure(m.reference, m.unit),
      status,
      note:
        m.score == null
          ? "missing on one side"
          : different && m.relative_difference != null
            ? `${Math.round(m.relative_difference * 100)}% apart`
            : undefined,
    };
  });
  for (const f of c.features) {
    checks.push({
      key: f.key,
      label: labelize(f.key),
      competitor: formatValue(f.competitor),
      reference: formatValue(f.reference),
      status:
        f.status === "match" ? "match" : f.status === "unknown" ? "unknown" : f.policy === "exclude" || blockingFields.has(f.key) ? "blocking" : "conflict",
      note: f.status === "conflict" && f.policy ? (f.policy === "exclude" ? "excludes the candidate" : "needs a review") : undefined,
    });
  }
  for (const d of c.differences) {
    if (d.kind !== "feature" || c.features.some((f) => f.key === d.field)) continue;
    checks.push({
      key: d.field,
      label: d.label ?? labelize(d.field),
      competitor: formatValue(d.competitor),
      reference: formatValue(d.reference),
      status: blockingFields.has(d.field) ? "blocking" : "conflict",
    });
  }
  return checks;
}

const normalize = (value: unknown) => formatValue(value).trim().toLowerCase();

// Union of the normalized attributes of both products, aligned by key. A key the engine
// compared takes its verdict; otherwise equal values are marked as such (not scored).
function attributeRows(left: CompareSide, right: CompareSide | null, checks: Map<string, Check>): Check[] {
  const present = (record: Record<string, unknown>) =>
    Object.keys(record).filter((k) => record[k] !== null && record[k] !== undefined && record[k] !== "");
  const leftKeys = present(left.attributes);
  const rightKeys = right ? present(right.attributes) : [];
  const shared = leftKeys.filter((k) => rightKeys.includes(k));
  const ordered = [...shared, ...leftKeys.filter((k) => !shared.includes(k)), ...rightKeys.filter((k) => !shared.includes(k))];
  return ordered.map((key) => {
    const l = left.attributes[key];
    const r = right?.attributes[key];
    const engine = checks.get(key.toLowerCase());
    const both = leftKeys.includes(key) && rightKeys.includes(key);
    return {
      key,
      label: labelize(key),
      competitor: formatValue(l),
      reference: formatValue(r),
      status: engine && engine.status !== "unknown" ? engine.status : !both ? "one_side" : normalize(l) === normalize(r) ? "same" : "differs",
    };
  });
}

const VISIBLE_ATTRIBUTES = 12;

// Side-by-side comparison: competitor product on the left, Antalis product on the right, in
// aligned rows (one grid, so both cells of a row share its height). On narrow screens the two
// columns stack through `order`. The engine checks and the attributes follow, full width.
export function SplitComparison({
  left,
  right,
  rightRole,
  candidate,
  empty,
}: {
  left: CompareSide;
  right: CompareSide | null;
  rightRole: { label: string; tone: "info" | "success" | "warning" | "violet" } | null;
  candidate: Candidate | null;
  empty: ReactNode;
}) {
  const checks = candidate ? engineChecks(candidate) : [];
  const byKey = new Map(checks.map((c) => [c.key.toLowerCase(), c]));
  const attributes = attributeRows(left, right, byKey);
  const counts = {
    match: checks.filter((c) => c.status === "match").length,
    conflict: checks.filter((c) => c.status === "conflict").length,
    blocking: checks.filter((c) => c.status === "blocking").length,
  };

  const rows: { label: string; render: (s: CompareSide) => ReactNode }[] = [
    { label: "Name", render: (s) => <NameCell side={s} /> },
    {
      label: "Reference",
      render: (s) => (
        <dl className="space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-xs text-slate-500">Reference</dt>
            <dd className="min-w-0 break-all">{s.reference ? <code className="text-xs text-slate-900">{s.reference}</code> : <span className="text-slate-400">—</span>}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-xs text-slate-500">Slug</dt>
            <dd className="min-w-0 break-all">{s.slug ? <code className="text-xs text-slate-700">{s.slug}</code> : <span className="text-slate-400">—</span>}</dd>
          </div>
        </dl>
      ),
    },
    {
      label: "Latest price",
      render: (s) =>
        s.price ? (
          <p className="text-sm">
            <span className="font-semibold text-slate-900">{formatPrice(s.price.from_price, s.price.currency)}</span>
            {s.price.price_unit ? (
              <span className="text-xs text-slate-500">
                {" "}
                / {s.price.price_unit_quantity && s.price.price_unit_quantity !== "1" ? `${s.price.price_unit_quantity} ` : ""}
                {s.price.price_unit}
              </span>
            ) : null}
            {s.price.tiers > 1 ? <span className="text-xs text-slate-500"> · {s.price.tiers} tiers</span> : null}
          </p>
        ) : (
          <p className="text-sm text-slate-400">No price captured</p>
        ),
    },
    { label: "Images", render: (s) => <ImageGallery images={s.images} alt={s.title ?? "Product image"} /> },
    {
      label: "Description",
      render: (s) =>
        s.description ? <ReadMore text={s.description} lines={5} /> : <p className="text-sm text-slate-400">{s.partial ? "Product details unavailable." : "No description."}</p>,
    },
  ];

  return (
    <section id="comparison" className="scroll-mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Side-by-side comparison">
      <div className="flex flex-col md:grid md:grid-cols-2">
        <Cell side="left" header>
          <OriginHeader side={left} kind="Competitor" />
        </Cell>
        {right ? (
          <Cell side="right" header>
            <OriginHeader side={right} kind="Antalis" role={rightRole} />
          </Cell>
        ) : (
          <div className="order-2 flex items-center justify-center border-t border-slate-200 bg-slate-50/60 p-8 md:order-none md:col-start-2 md:row-span-6 md:border-l md:border-t-0">
            {empty}
          </div>
        )}
        {rows.map((row) => (
          <Row key={row.label} label={row.label} left={row.render(left)} right={right ? row.render(right) : null} />
        ))}
      </div>

      {right ? (
        <div className="border-t border-slate-200">
          <SectionTitle
            title="Compared by the engine"
            aside={
              candidate ? (
                <span className="flex flex-wrap gap-1.5">
                  {counts.match ? <Chip status="match" text={`${counts.match} match`} /> : null}
                  {counts.conflict ? <Chip status="conflict" text={`${counts.conflict} differ`} /> : null}
                  {counts.blocking ? <Chip status="blocking" text={`${counts.blocking} incompatible`} /> : null}
                </span>
              ) : null
            }
          />
          {!candidate ? (
            <p className="px-5 pb-4 text-sm text-slate-500">The engine did not score this pair: preview it to see the comparison.</p>
          ) : checks.length > 0 ? (
            checks.map((c) => <CheckRow key={`${c.key}-${c.label}`} check={c} />)
          ) : (
            <p className="px-5 pb-4 text-sm text-slate-500">No measure or characteristic comparable on both sides.</p>
          )}
        </div>
      ) : null}

      <div className="border-t border-slate-200">
        <SectionTitle title="Attributes" aside={<span className="text-xs text-slate-500">{attributes.length} in total</span>} />
        {attributes.length === 0 ? (
          <p className="px-5 pb-4 text-sm text-slate-500">No normalized attribute on either side.</p>
        ) : (
          <>
            {attributes.slice(0, VISIBLE_ATTRIBUTES).map((c) => (
              <CheckRow key={c.key} check={c} />
            ))}
            {attributes.length > VISIBLE_ATTRIBUTES ? (
              <details className="group">
                <summary className="cursor-pointer select-none border-t border-slate-100 px-5 py-2.5 text-xs font-medium text-indigo-600 hover:text-indigo-500">
                  <span className="group-open:hidden">Show {attributes.length - VISIBLE_ATTRIBUTES} more attributes</span>
                  <span className="hidden group-open:inline">Show fewer attributes</span>
                </summary>
                {attributes.slice(VISIBLE_ATTRIBUTES).map((c) => (
                  <CheckRow key={c.key} check={c} />
                ))}
              </details>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function Cell({ side, header, children }: { side: "left" | "right"; header?: boolean; children: ReactNode }) {
  return (
    <div
      className={cx(
        "min-w-0 px-5 py-4",
        side === "left" ? "order-1 md:order-none md:col-start-1" : "order-2 md:order-none md:col-start-2 md:border-l md:border-slate-200",
        header
          ? side === "left"
            ? "bg-slate-50"
            : "border-t border-slate-200 bg-indigo-50/70 md:border-t-0"
          : cx("border-t border-slate-100", side === "right" && "bg-indigo-50/20"),
      )}
    >
      {children}
    </div>
  );
}

function Row({ label, left, right }: { label: string; left: ReactNode; right: ReactNode | null }) {
  const heading = <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>;
  return (
    <>
      <Cell side="left">
        {heading}
        {left}
      </Cell>
      {right !== null ? (
        <Cell side="right">
          {heading}
          {right}
        </Cell>
      ) : null}
    </>
  );
}

function OriginHeader({
  side,
  kind,
  role,
}: {
  side: CompareSide;
  kind: string;
  role?: { label: string; tone: "info" | "success" | "warning" | "violet" } | null;
}) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 text-sm">
          <span className={cx("size-2 shrink-0 rounded-full", kind === "Antalis" ? "bg-indigo-500" : "bg-slate-400")} aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{kind}</span>
          {side.origin.siteUrl ? (
            <a href={side.origin.siteUrl} target="_blank" rel="noreferrer" className="truncate font-medium text-slate-900 hover:text-indigo-600">
              {side.origin.name} ↗
            </a>
          ) : (
            <span className="truncate font-medium text-slate-900">{side.origin.name}</span>
          )}
        </p>
        {role ? <Badge tone={role.tone}>{role.label}</Badge> : null}
      </div>
      <p className="flex flex-wrap gap-x-3 text-xs">
        <Link href={`/products/${side.id}`} className="font-medium text-indigo-600 hover:text-indigo-500">
          Product page
        </Link>
        <a href={side.url} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:text-indigo-500">
          Open on the site ↗
        </a>
        <span className="text-slate-400">#{side.id}</span>
      </p>
    </div>
  );
}

function NameCell({ side }: { side: CompareSide }) {
  return (
    <div className="space-y-1.5">
      <p className="text-base font-semibold leading-snug text-slate-900">{side.title ?? "Untitled product"}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {side.brand ? <Badge tone="violet">{side.brand}</Badge> : null}
        {side.status === "missing" ? <Badge tone="danger">Missing from the catalog</Badge> : null}
      </div>
      {side.category.length > 0 ? <p className="text-xs text-slate-500">{side.category.join(" / ")}</p> : null}
    </div>
  );
}

function SectionTitle({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-2 pt-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {aside}
    </div>
  );
}

function Chip({ status, text }: { status: Status; text?: string }) {
  const style = STATUS_STYLES[status];
  if (!style.label) return null;
  return (
    <span className={cx("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", style.chip)}>
      <span aria-hidden>{style.icon}</span>
      {text ?? style.label}
    </span>
  );
}

// One aligned row: label and competitor value in the left half, Antalis value and verdict in
// the right half, tinted by the verdict.
function CheckRow({ check }: { check: Check }) {
  const style = STATUS_STYLES[check.status];
  return (
    <div className={cx("grid grid-cols-2 border-t border-slate-100 text-sm", style.row)}>
      <div className="flex min-w-0 flex-col gap-0.5 px-5 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <span className="shrink-0 text-xs font-medium text-slate-500">{check.label}</span>
        <span className="min-w-0 break-words tabular-nums text-slate-900 sm:text-right">{check.competitor}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-1 border-l border-slate-200/70 px-5 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <span className="min-w-0 break-words tabular-nums text-slate-900">{check.reference}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {check.note ? <span className="text-[11px] text-slate-500">{check.note}</span> : null}
          <Chip status={check.status} />
        </span>
      </div>
    </div>
  );
}
