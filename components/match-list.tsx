import { FilterBar, FilterField, FilterGroup, FilterMulti, FilterNumber, FilterOrder, FilterSearch, FilterSelect, FilterSheet, FilterToggle } from "@/components/filters";
import { FilterChips, RowChevron } from "@/components/kit";
import { LinkRow } from "@/components/link-row";
import { DecisionReasons, MatchStatusBadge, ProductCell, ScoreRing } from "@/components/matching";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { clearFiltersHref, filterChips } from "@/lib/filter-chips";
import { formatDateTime, formatRelative } from "@/lib/format";
import { DEFAULT_SORT, MATCH_LIST_PATHS, reviewHref, type MatchListKind, type parseMatchFilters } from "@/lib/match-filters";
import {
  DECISION_REASON_LABELS,
  DEPRECATED_REASON_LABELS,
  DEPRECATED_REASONS,
  MATCH_SORTS,
  MATCH_SORT_LABELS,
  MATCH_STATUSES,
  MATCH_STATUS_LABELS,
  decisionReasonLabel,
  formatScore,
  type Thresholds,
} from "@/lib/matching";
import type { QueryValues } from "@/lib/params";
import type { Competitor, DeprecatedReason, MatchListItem, MatchStatus } from "@/lib/types";

type Filters = ReturnType<typeof parseMatchFilters>;

// Filters of the three match lists, ordered from the most used: the competitor product search
// and the competitor inline, then in the sheet the Antalis side, the score, the decision and
// the product. Active filters show as removable chips; the sort sits on the right.
export function MatchFilters({ kind, filters, competitors }: { kind: MatchListKind; filters: Filters; competitors: Competitor[] }) {
  const basePath = MATCH_LIST_PATHS[kind];
  const names = new Map(competitors.map((c) => [c.key, c.name]));
  const yesNo = (yes: string, no: string) => (v: string) => (v === "1" ? yes : no);
  const chips = filterChips(basePath, filters.values, [
    { name: "q", label: "Competitor product" },
    { name: "competitor", label: "Competitor", format: (v) => names.get(v) ?? v },
    { name: "status", label: "Status", format: (v) => MATCH_STATUS_LABELS[v as MatchStatus] ?? v },
    { name: "antalis_q", label: "Antalis product" },
    { name: "antalis_product_id", label: "Antalis product", format: (v) => `#${v}` },
    { name: "min_score", label: "Score ≥" },
    { name: "max_score", label: "Score ≤" },
    { name: "decided", label: "Decision", format: yesNo("By a human", "Engine only") },
    { name: "manual_choice", label: "Choice", format: yesNo("Other than proposed", "Proposal kept") },
    { name: "reason", label: "Reason", format: (v) => decisionReasonLabel(v) },
    { name: "deprecated_reason", label: "Obsolete because", format: (v) => DEPRECATED_REASON_LABELS[v as DeprecatedReason] ?? v },
    { name: "dimensions_compared", label: "Dimensions", format: yesNo("Compared", "Not compared") },
    { name: "product_status", label: "Product", format: (v) => (v === "active" ? "Active" : "Missing") },
  ]);
  const clearHref = clearFiltersHref(basePath, filters.values, ["sort", "order"]);
  const inline = new Set(["q", "competitor"]);

  return (
    <FilterBar
      trailing={
        <>
          <FilterSelect name="sort" label="Sort by" defaultValue={DEFAULT_SORT[kind]} options={MATCH_SORTS.map((s) => ({ value: s, label: MATCH_SORT_LABELS[s] }))} />
          <FilterOrder />
        </>
      }
    >
      <FilterSearch name="q" label="Search competitor products" placeholder="Competitor product…" />
      <FilterSelect name="competitor" label="Competitor" allLabel="All competitors" options={competitors.map((c) => ({ value: c.key, label: c.name }))} />
      <FilterSheet count={chips.filter((c) => !inline.has(c.key.split("=")[0])).length} clearHref={clearHref}>
        {kind === "matches" ? (
          <FilterGroup title="Status">
            <FilterMulti name="status" label="Match status" options={MATCH_STATUSES.map((s) => ({ value: s, label: MATCH_STATUS_LABELS[s] }))} />
          </FilterGroup>
        ) : null}

        <FilterGroup title="Antalis side">
          <FilterField label="Antalis product">
            <FilterSearch name="antalis_q" label="Search Antalis products" placeholder="Title, reference…" className="w-full" />
          </FilterField>
        </FilterGroup>

        <FilterGroup title="Score">
          <FilterField label="Similarity score, 0 to 100">
            <div className="flex items-center gap-2">
              <FilterNumber name="min_score" label="Minimum score" placeholder="Min" min={0} max={100} />
              <span className="text-muted-foreground">–</span>
              <FilterNumber name="max_score" label="Maximum score" placeholder="Max" min={0} max={100} />
            </div>
          </FilterField>
        </FilterGroup>

        <FilterGroup title="Decision">
          {kind !== "review" ? (
            <>
              <FilterField label="Decided by">
                <FilterToggle name="decided" label="Decided by" options={[{ value: "1", label: "A human" }, { value: "0", label: "The engine" }]} />
              </FilterField>
              <FilterField label="Choice">
                <FilterToggle name="manual_choice" label="Choice" options={[{ value: "0", label: "Proposal kept" }, { value: "1", label: "Other product" }]} />
              </FilterField>
            </>
          ) : null}
          <FilterField label="Engine reason">
            <FilterSelect name="reason" label="Engine reason" allLabel="Any reason" className="w-full" options={Object.entries(DECISION_REASON_LABELS).map(([value, label]) => ({ value, label }))} />
          </FilterField>
          {kind !== "review" ? (
            <FilterField label="Obsolete because">
              <FilterSelect name="deprecated_reason" label="Obsolete because" allLabel="Any reason" className="w-full" options={DEPRECATED_REASONS.map((r) => ({ value: r, label: DEPRECATED_REASON_LABELS[r] }))} />
            </FilterField>
          ) : null}
        </FilterGroup>

        <FilterGroup title="Product">
          <FilterField label="Dimensions">
            <FilterToggle name="dimensions_compared" label="Dimensions" options={[{ value: "1", label: "Compared" }, { value: "0", label: "Not compared" }]} />
          </FilterField>
          <FilterField label="Competitor product">
            <FilterToggle name="product_status" label="Product status" options={[{ value: "active", label: "Active" }, { value: "missing", label: "Missing" }]} />
          </FilterField>
        </FilterGroup>
      </FilterSheet>
      <FilterChips chips={chips} clearHref={clearHref} />
    </FilterBar>
  );
}

// Matches of a list. A whole row opens the review screen (keeping the position in the list);
// the scores are drawn with the same ring as the review screen.
export function MatchTable({ kind, items, values, offset, thresholds }: { kind: MatchListKind; items: MatchListItem[]; values: QueryValues; offset: number; thresholds: Thresholds }) {
  return (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Competitor product</TableHead>
            <TableHead>{kind === "deprecated" ? "Former association" : "Antalis product"}</TableHead>
            <TableHead>Score</TableHead>
            <TableHead className="text-right">Gap to 2nd</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>{kind === "deprecated" ? "Obsolete since" : "Updated"}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((m, i) => {
            const href = reviewHref(m.product.id, { kind, values, position: offset + i });
            const reference = m.antalis_product ?? m.proposed_antalis_product;
            const when = kind === "deprecated" ? m.deprecated_at : m.updated_at;
            return (
              <LinkRow key={m.id} href={href} className="align-top">
                <TableCell className="pl-4">
                  <ProductCell product={m.product} href={href} />
                  <p className="mt-1 pl-13 text-xs text-muted-foreground">{m.competitor_key}</p>
                </TableCell>
                <TableCell>
                  <ProductCell product={reference} href={null} note={!m.antalis_product && m.proposed_antalis_product ? "proposed" : undefined} />
                </TableCell>
                <TableCell>
                  <ScoreRing score={m.score} thresholds={thresholds} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {m.score_gap !== null ? (
                    <span title={m.runner_up_score !== null ? `2nd candidate: ${formatScore(m.runner_up_score)}` : undefined}>{formatScore(m.score_gap)}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <div className="max-w-56 space-y-1">
                    <MatchStatusBadge status={m.status} manualChoice={m.manual_choice} />
                    {m.status === "deprecated" ? (
                      <p className="text-xs text-muted-foreground">
                        was {m.previous_status ? MATCH_STATUS_LABELS[m.previous_status] : "—"}
                        {m.deprecated_reason ? ` · ${DEPRECATED_REASON_LABELS[m.deprecated_reason]}` : null}
                      </p>
                    ) : (
                      <DecisionReasons reasons={m.decision_reasons} compact />
                    )}
                    {m.decided_by ? <p className="text-xs text-muted-foreground">by {m.decided_by}</p> : null}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground" title={formatDateTime(when)}>
                    {formatRelative(when)}
                  </span>
                </TableCell>
                <RowChevron />
              </LinkRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
