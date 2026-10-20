import Link from "next/link";
import { DecisionReasons, MatchStatusBadge, ProductCell, ScoreGauge } from "@/components/matching";
import { Card, Field, FilterBar, Table, Td, Th, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { formatDateTime, formatRelative } from "@/lib/format";
import { MATCH_LIST_PATHS, reviewHref, type MatchListKind, type parseMatchFilters } from "@/lib/match-filters";
import {
  DECISION_REASON_LABELS,
  DEPRECATED_REASON_LABELS,
  DEPRECATED_REASONS,
  MATCH_SORTS,
  MATCH_SORT_LABELS,
  MATCH_STATUSES,
  MATCH_STATUS_LABELS,
  formatScore,
} from "@/lib/matching";
import type { QueryValues } from "@/lib/params";
import type { Competitor, MatchListItem } from "@/lib/types";

type Filters = ReturnType<typeof parseMatchFilters>;

const triState = (value: boolean | undefined) => (value === undefined ? "" : value ? "1" : "0");

export function MatchFilters({ kind, filters, competitors }: { kind: MatchListKind; filters: Filters; competitors: Competitor[] }) {
  const s = filters.state;
  return (
    <FilterBar>
      <Field label="Competitor">
        <select className={inputClass} name="competitor" defaultValue={s.competitor ?? ""}>
          <option value="">All competitors</option>
          {competitors.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Competitor product">
        <input className={`${inputClass} w-52`} name="q" defaultValue={s.q} placeholder="Title, reference, brand…" />
      </Field>
      <Field label="Antalis product">
        <input className={`${inputClass} w-52`} name="antalis_q" defaultValue={s.antalisQ} placeholder="Title, reference…" />
      </Field>
      <Field label="Score">
        <span className="flex items-center gap-1.5">
          <input className={`${inputClass} w-20`} name="min_score" type="number" min={0} max={100} step="any" defaultValue={s.minScore ?? ""} placeholder="min" aria-label="Minimum score" />
          <span className="text-slate-400">–</span>
          <input className={`${inputClass} w-20`} name="max_score" type="number" min={0} max={100} step="any" defaultValue={s.maxScore ?? ""} placeholder="max" aria-label="Maximum score" />
        </span>
      </Field>
      {kind !== "review" ? (
        <>
          <Field label="Decision">
            <select className={inputClass} name="decided" defaultValue={triState(s.decided)}>
              <option value="">Any</option>
              <option value="1">Decided by a human</option>
              <option value="0">Engine only</option>
            </select>
          </Field>
          <Field label="Manual choice">
            <select className={inputClass} name="manual_choice" defaultValue={triState(s.manualChoice)}>
              <option value="">Any</option>
              <option value="1">Another product than proposed</option>
              <option value="0">Proposal kept</option>
            </select>
          </Field>
        </>
      ) : null}
      <Field label="Decision reason">
        <select className={inputClass} name="reason" defaultValue={s.reason ?? ""}>
          <option value="">Any</option>
          {Object.entries(DECISION_REASON_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      {kind !== "review" ? (
        <Field label="Obsolete because">
          <select className={inputClass} name="deprecated_reason" defaultValue={s.deprecatedReason ?? ""}>
            <option value="">Any</option>
            {DEPRECATED_REASONS.map((r) => (
              <option key={r} value={r}>
                {DEPRECATED_REASON_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field label="Dimensions">
        <select className={inputClass} name="dimensions_compared" defaultValue={triState(s.dimensionsCompared)}>
          <option value="">Any</option>
          <option value="1">Compared</option>
          <option value="0">Not compared</option>
        </select>
      </Field>
      <Field label="Product status">
        <select className={inputClass} name="product_status" defaultValue={s.productStatus ?? ""}>
          <option value="">Any</option>
          <option value="active">Active</option>
          <option value="missing">Missing</option>
        </select>
      </Field>
      <Field label="Sort by">
        <select className={inputClass} name="sort" defaultValue={s.sort}>
          {MATCH_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {MATCH_SORT_LABELS[sort]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Order">
        <select className={inputClass} name="order" defaultValue={s.order}>
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </Field>
      {s.antalisProductId ? <input type="hidden" name="antalis_product_id" value={s.antalisProductId} /> : null}
      {kind === "matches" ? (
        <fieldset className="flex w-full flex-wrap items-center gap-x-4 gap-y-2">
          <legend className="mb-1 text-xs font-medium text-slate-600">Status</legend>
          {MATCH_STATUSES.map((status) => (
            <label key={status} className="inline-flex items-center gap-1.5 text-sm text-slate-700">
              <input type="checkbox" name="status" value={status} defaultChecked={s.status.includes(status)} />
              {MATCH_STATUS_LABELS[status]}
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className="flex gap-2">
        <button type="submit" className={primaryButton}>
          Apply
        </button>
        <Link href={MATCH_LIST_PATHS[kind]} className={secondaryButton}>
          Reset
        </Link>
      </div>
    </FilterBar>
  );
}

export function MatchTable({
  kind,
  items,
  values,
  offset,
}: {
  kind: MatchListKind;
  items: MatchListItem[];
  values: QueryValues;
  offset: number;
}) {
  return (
    <Card padded={false}>
      <Table>
        <thead>
          <tr>
            <Th>Competitor product</Th>
            <Th>{kind === "deprecated" ? "Former association" : "Antalis product"}</Th>
            <Th>Score</Th>
            <Th align="right">Gap to 2nd</Th>
            <Th>Status</Th>
            <Th>{kind === "deprecated" ? "Obsolete since" : "Updated"}</Th>
            <Th />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((m, i) => {
            const href = reviewHref(m.product.id, { kind, values, position: offset + i });
            const reference = m.antalis_product ?? m.proposed_antalis_product;
            return (
              <tr key={m.id} className="align-top hover:bg-slate-50">
                <Td>
                  <ProductCell product={m.product} />
                  <p className="mt-0.5 text-xs text-slate-400">{m.competitor_key}</p>
                </Td>
                <Td>
                  <ProductCell product={reference} note={!m.antalis_product && m.proposed_antalis_product ? "proposed" : undefined} />
                </Td>
                <Td>
                  <ScoreGauge score={m.score} />
                </Td>
                <Td align="right">
                  {m.score_gap !== null ? (
                    <span title={m.runner_up_score !== null ? `2nd candidate: ${formatScore(m.runner_up_score)}` : undefined}>{formatScore(m.score_gap)}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </Td>
                <Td>
                  <div className="space-y-1">
                    <MatchStatusBadge status={m.status} manualChoice={m.manual_choice} />
                    {m.status === "deprecated" ? (
                      <p className="text-xs text-slate-500">
                        was {m.previous_status ? MATCH_STATUS_LABELS[m.previous_status] : "—"}
                        {m.deprecated_reason ? ` · ${DEPRECATED_REASON_LABELS[m.deprecated_reason]}` : null}
                      </p>
                    ) : (
                      <div className="max-w-56">
                        <DecisionReasons reasons={m.decision_reasons} compact />
                      </div>
                    )}
                    {m.decided_by ? <p className="text-xs text-slate-400">by {m.decided_by}</p> : null}
                  </div>
                </Td>
                <Td>
                  <span className="whitespace-nowrap text-xs text-slate-600" title={formatDateTime(kind === "deprecated" ? m.deprecated_at : m.updated_at)}>
                    {formatRelative(kind === "deprecated" ? m.deprecated_at : m.updated_at)}
                  </span>
                </Td>
                <Td>
                  <Link href={href} className="whitespace-nowrap text-sm font-medium text-indigo-600 hover:text-indigo-500">
                    {kind === "review" ? "Review →" : "Open →"}
                  </Link>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}
