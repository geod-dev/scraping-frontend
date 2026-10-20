import { CheckCheckIcon, CheckIcon, MailIcon } from "lucide-react";
import { markAllNotificationsRead, setNotificationRead } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { FilterBar, FilterField, FilterGroup, FilterSelect, FilterSheet, FilterToggle } from "@/components/filters";
import { ApiUnavailable, EmptyState, FilterChips, PageHeader, Pagination, StatusBadge } from "@/components/kit";
import { LiveRefresh } from "@/components/live";
import { NotificationLinks } from "@/components/notification-links";
import { Card } from "@/components/ui/card";
import { apiFetch, settle } from "@/lib/api";
import { clearFiltersHref, filterChips } from "@/lib/filter-chips";
import { formatDateTime, formatRelative, labelize } from "@/lib/format";
import { boolFlag, oneOf, positiveInt, text, type SearchParams } from "@/lib/params";
import { cn } from "@/lib/utils";
import type { Competitor, Notification, Paginated, UnreadCount } from "@/lib/types";

export const metadata = { title: "Notifications" };

const PAGE_SIZE = 25;
const LEVELS = ["info", "success", "warning", "error"] as const;
const KINDS = [
  "job_started",
  "job_paused",
  "job_resumed",
  "job_succeeded",
  "job_partial",
  "job_failed",
  "job_cancelled",
  "job_interrupted",
  "job_crashed",
  "job_auto_resumed",
  "job_auto_resume_stopped",
  "error_burst",
  "page_errors",
  "matching_summary",
  "matches_deprecated",
] as const;

const LEVEL_DOTS: Record<string, string> = { info: "bg-sky-500", success: "bg-emerald-500", warning: "bg-amber-500", error: "bg-rose-500" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const unread = boolFlag(sp.unread);
  const level = oneOf(sp.level, LEVELS);
  const kind = oneOf(sp.kind, KINDS);
  const competitor = text(sp.competitor, 64);
  const offset = positiveInt(sp.offset, 0);

  const [competitors, notifications, unreadCount] = await Promise.all([
    settle(apiFetch<Competitor[]>("/competitors")),
    settle(
      apiFetch<Paginated<Notification>>("/notifications", {
        query: { unread, level: level ? [level] : undefined, kind: kind ? [kind] : undefined, competitor, limit: PAGE_SIZE, offset },
      }),
    ),
    settle(apiFetch<UnreadCount>("/notifications/unread-count", { query: { competitor } })),
  ]);

  const competitorKeys = new Map(competitors.data?.map((c) => [c.id, c.key]));
  const names = new Map(competitors.data?.map((c) => [c.key, c.name]));
  const values = { unread: unread === undefined ? undefined : unread ? "1" : "0", competitor, kind, level };
  const chips = filterChips("/notifications", values, [
    { name: "unread", label: "Read state", format: (v) => (v === "1" ? "Unread" : "Read") },
    { name: "competitor", label: "Competitor", format: (v) => names.get(v) ?? v },
    { name: "kind", label: "Kind", format: labelize },
    { name: "level", label: "Level", format: labelize },
  ]);
  const clearHref = clearFiltersHref("/notifications", values);

  return (
    <>
      <LiveRefresh on={["notification.created"]} />
      <PageHeader
        title="Notifications"
        description={unreadCount.data ? `${unreadCount.data.unread} unread · alerts and events from the jobs` : "Alerts and events from the jobs"}
        actions={
          <ActionButton
            action={markAllNotificationsRead}
            input={{ competitor }}
            label="Mark all as read"
            icon={<CheckCheckIcon />}
            disabled={!unreadCount.data || unreadCount.data.unread === 0}
          />
        }
        toolbar={
          <FilterBar>
            <FilterToggle name="unread" label="Read state" anyLabel="All" options={[{ value: "1", label: "Unread", count: unreadCount.data?.unread || null }, { value: "0", label: "Read" }]} />
            <FilterSelect name="competitor" label="Competitor" allLabel="All competitors" options={(competitors.data ?? []).map((c) => ({ value: c.key, label: c.name }))} />
            <FilterSheet count={chips.filter((c) => c.key === "kind" || c.key === "level").length} clearHref={clearHref}>
              <FilterGroup title="Notification">
                <FilterField label="Level">
                  <FilterToggle name="level" label="Level" options={LEVELS.map((l) => ({ value: l, label: labelize(l), count: unreadCount.data?.by_level[l] || null }))} />
                </FilterField>
                <FilterField label="Kind">
                  <FilterSelect name="kind" label="Kind" allLabel="Any kind" className="w-full" options={KINDS.map((k) => ({ value: k, label: labelize(k) }))} />
                </FilterField>
              </FilterGroup>
            </FilterSheet>
            <FilterChips chips={chips} clearHref={clearHref} />
          </FilterBar>
        }
      />

      {notifications.error ? <ApiUnavailable message={notifications.error} /> : null}

      {notifications.data ? (
        notifications.data.items.length === 0 ? (
          <EmptyState title="Nothing here">No notification matches these filters.</EmptyState>
        ) : (
          <>
            <Card className="py-0">
              <ul className="divide-y">
                {notifications.data.items.map((n) => (
                  <li key={n.id} className={cn("flex gap-3 px-4 py-3.5", !n.read && "bg-primary/[0.03]")}>
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-muted-foreground/25" : LEVEL_DOTS[n.level])} aria-label={n.read ? "Read" : "Unread"} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("text-sm", n.read ? "text-foreground/80" : "font-semibold")}>{n.title}</span>
                        <StatusBadge status={n.level} label={labelize(n.level)} />
                      </div>
                      {n.message ? <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p> : null}
                      <p className="mt-1 text-xs text-muted-foreground" title={formatDateTime(n.created_at)}>
                        {labelize(n.kind)} · {formatRelative(n.created_at)}
                      </p>
                      <NotificationLinks notification={n} competitorKey={competitorKeys.get(n.competitor_id ?? -1)} />
                    </div>
                    <ActionButton
                      action={setNotificationRead}
                      input={{ id: n.id, read: !n.read }}
                      label={<span className="sr-only">{n.read ? "Mark unread" : "Mark read"}</span>}
                      icon={n.read ? <MailIcon /> : <CheckIcon />}
                      title={n.read ? "Mark unread" : "Mark read"}
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                    />
                  </li>
                ))}
              </ul>
            </Card>
            <Pagination basePath="/notifications" query={values} total={notifications.data.total} limit={notifications.data.limit} offset={notifications.data.offset} />
          </>
        )
      ) : null}
    </>
  );
}
