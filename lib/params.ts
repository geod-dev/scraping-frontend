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

// Every allowed value of a repeatable parameter (?status=a&status=b).
export function manyOf<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T[] {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  return raw.filter((v): v is T => (allowed as readonly string[]).includes(v));
}

export function decimal(value: string | string[] | undefined, min: number, max: number): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

export type QueryValues = Record<string, string | string[] | undefined>;

// Serializes only the defined, non-empty values into a query string (no leading "?").
// Arrays become repeated parameters.
export function buildQuery(values: QueryValues): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      for (const item of value) if (item) params.append(key, item);
    } else if (value) {
      params.set(key, value);
    }
  }
  return params.toString();
}

export function boolFlag(value: string | string[] | undefined): boolean | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return undefined;
}
