import { SidebarNav } from "@/components/nav";
import { apiFetch, settle } from "@/lib/api";
import type { UnreadCount } from "@/lib/types";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  // A failed count only hides the badge; it never blocks the page.
  const unread = await settle(apiFetch<UnreadCount>("/notifications/unread-count"));

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-slate-200 bg-white px-4 py-4 lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
        <div className="mb-4 flex items-center gap-2.5 px-2 lg:mb-8">
          <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            CC
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Competitor Catalog</p>
            <p className="text-xs text-slate-500">Scraper console</p>
          </div>
        </div>
        <SidebarNav unreadNotifications={unread.data?.unread ?? 0} />
      </aside>
      <main className="min-w-0 flex-1 lg:pl-60">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
