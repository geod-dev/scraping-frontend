export type SearchParams = Record<string, string | string[] | undefined>;

export function text(value: string | string[] | undefined, max = 200): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const trimmed = raw.trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : undefined;
}

export function positiveInt(value: string | string[] | undefined, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

export function oneOf<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;
}

// Serializes only the defined, non-empty values into a query string (no leading "?").
export function buildQuery(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export function boolFlag(value: string | string[] | undefined): boolean | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return undefined;
}
