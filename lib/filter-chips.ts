import type { ReactNode } from "react";
import { buildQuery, type QueryValues } from "@/lib/params";

// Chips of the active filters of a list page. Each chip links to the same page without that
// value (pagination restarts); repeated parameters get one chip per value.

export type ChipDef = { name: string; label: string; format?: (value: string) => ReactNode };

export type Chip = { key: string; label: ReactNode; href: string };

function href(basePath: string, values: QueryValues): string {
  const qs = buildQuery({ ...values, offset: undefined });
  return qs ? `${basePath}?${qs}` : basePath;
}

export function filterChips(basePath: string, values: QueryValues, defs: ChipDef[]): Chip[] {
  const chips: Chip[] = [];
  for (const def of defs) {
    const value = values[def.name];
    const shown = (v: string) => (def.format ? def.format(v) : v);
    if (Array.isArray(value)) {
      for (const item of value) {
        if (!item) continue;
        chips.push({
          key: `${def.name}=${item}`,
          label: `${def.label}: ${String(shown(item))}`,
          href: href(basePath, { ...values, [def.name]: value.filter((v) => v !== item) }),
        });
      }
    } else if (value) {
      const label = shown(value);
      chips.push({
        key: def.name,
        label: typeof label === "string" ? `${def.label}: ${label}` : label,
        href: href(basePath, { ...values, [def.name]: undefined }),
      });
    }
  }
  return chips;
}

// Same page with only the parameters that are not filters (e.g. the sort) kept.
export function clearFiltersHref(basePath: string, values: QueryValues, keep: string[] = []): string {
  return href(basePath, Object.fromEntries(keep.map((k) => [k, values[k]])));
}
