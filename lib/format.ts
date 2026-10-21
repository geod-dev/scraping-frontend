const LOCALE = "en-GB";

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(LOCALE).format(value);
}

export function formatPrice(value: string | number | null | undefined, currency = "EUR"): string {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) return String(value);
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency }).format(numeric);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return "never";
  const date = new Date(value);
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSeconds, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSeconds / 3600), "hour");
  return rtf.format(Math.round(diffSeconds / 86400), "day");
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function labelize(value: string | null | undefined): string {
  if (!value) return "—";
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Days elapsed since `value` (null when unknown).
export function ageInDays(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : (Date.now() - time) / 86_400_000;
}

const DELETED_LABELS: [key: string, one: string, many: string][] = [
  ["categories", "category", "categories"],
  ["products", "product", "products"],
  ["observations", "price observation", "price observations"],
  ["matches", "match", "matches"],
  ["matches_deprecated", "match of other competitors made obsolete", "matches of other competitors made obsolete"],
];

// What a category ban deleted, e.g. "3 categories · 120 products · 4,512 price observations"
// (zero counts left out).
export function formatDeleted(deleted: Record<string, unknown> | null | undefined): string {
  const parts = DELETED_LABELS.flatMap(([key, one, many]) => {
    const n = deleted?.[key];
    return typeof n === "number" && n > 0 ? [`${formatNumber(n)} ${n === 1 ? one : many}`] : [];
  });
  return parts.length > 0 ? parts.join(" · ") : "nothing";
}
