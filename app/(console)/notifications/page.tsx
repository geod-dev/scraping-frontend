import Link from "next/link";
import { markAllNotificationsRead, setNotificationRead } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { ApiUnavailable, Card, EmptyState, Field, FilterBar, PageHeader, Pagination, StatusBadge, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { apiFetch, settle } from "@/lib/api";
import { formatDateTime, formatRelative, labelize } from "@/lib/format";
import { boolFlag, oneOf, positiveInt, text, type SearchParams } from "@/lib/params";
import type { Competitor, Notification, Paginated, UnreadCount } from "@/lib/types";

export const metadata = { title: "Notifications" };

const PAGE_SIZE = 25;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const unread = boolFlag(sp.unread);
  const level = oneOf(sp.level, ["info", "success", "warning", "error"] as const);
  const competitor = text(sp.competitor, 64);
  const offset = positiveInt(sp.offset, 0);

  const [competitors, notifications, unreadCount] = await Promise.all([
    settle(apiFetch<Competitor[]>("/competitors")),
    settle(
      apiFetch<Paginated<Notification>>("/notifications", {
        query: { unread, level: level ? [level] : undefined, competitor, limit: PAGE_SIZE, offset },
      }),
    ),
    settle(apiFetch<UnreadCount>("/notifications/unread-count", { query: { competitor } })),
  ]);

  const paging = {
    unread: unread === undefined ? undefined : unread ? "1" : "0",
    level,
    competitor,
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unreadCount.data ? `${unreadCount.data.unread} unread` : "Alerts and events from scraping jobs"}
        actions={
          <ActionButton
            action={markAllNotificationsRead}
            input={{ competitor }}
            label="Mark all as read"
            variant="secondary"
            disabled={!unreadCount.data || unreadCount.data.unread === 0}
          />
        }
      />

      <FilterBar>
        <Field label="Competitor">
          <select className={inputClass} name="competitor" defaultValue={competitor ?? ""}>
            <option value="">All competitors</option>
            {competitors.data?.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Read state">
          <select className={inputClass} name="unread" defaultValue={unread === undefined ? "" : unread ? "1" : "0"}>
            <option value="">All</option>
            <option value="1">Unread</option>
            <option value="0">Read</option>
          </select>
        </Field>
        <Field label="Level">
          <select className={inputClass} name="level" defaultValue={level ?? ""}>
            <option value="">Any</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </Field>
        <div className="flex gap-2">
          <button type="submit" className={primaryButton}>
            Apply
          </button>
          <Link href="/notifications" className={secondaryButton}>
            Reset
          </Link>
        </div>
      </FilterBar>

      {notifications.error ? <ApiUnavailable message={notifications.error} /> : null}

      {notifications.data ? (
        notifications.data.items.length === 0 ? (
          <EmptyState title="Nothing here">No notifications match these filters.</EmptyState>
        ) : (
          <>
            <Card padded={false}>
              <ul className="divide-y divide-slate-100">
                {notifications.data.items.map((n) => (
                  <li key={n.id} className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between ${n.read ? "" : "bg-indigo-50/40"}`}>
                    <div className="flex min-w-0 gap-3">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-indigo-500"}`} aria-hidden />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={n.level} label={labelize(n.level)} />
                          <span className={`text-sm ${n.read ? "text-slate-700" : "font-semibold text-slate-900"}`}>{n.title}</span>
                        </div>
                        {n.message ? <p className="mt-1 text-sm text-slate-600">{n.message}</p> : null}
                        <p className="mt-1 text-xs text-slate-400">
                          {labelize(n.kind)} · {formatRelative(n.created_at)} · {formatDateTime(n.created_at)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs">
                          {n.job_id ? (
                            <Link href={`/jobs/${n.job_id}`} className="text-indigo-600 hover:text-indigo-500">
                              Job #{n.job_id}
                            </Link>
                          ) : null}
                          {n.scrape_run_id ? (
                            <Link href={`/runs/${n.scrape_run_id}`} className="text-indigo-600 hover:text-indigo-500">
                              Run #{n.scrape_run_id}
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <ActionButton
                        action={setNotificationRead}
                        input={{ id: n.id, read: !n.read }}
                        label={n.read ? "Mark unread" : "Mark read"}
                        variant="secondary"
                        className="h-8 px-3 text-xs"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
            <Pagination basePath="/notifications" query={paging} total={notifications.data.total} limit={notifications.data.limit} offset={notifications.data.offset} />
          </>
        )
      ) : null}
    </>
  );
}
