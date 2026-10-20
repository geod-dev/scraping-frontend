"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

type Item = { href: string; label: string; icon: string };

const ITEMS: Item[] = [
  { href: "/", label: "Overview", icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { href: "/competitors", label: "Competitors", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/products", label: "Products", icon: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8" },
  { href: "/categories", label: "Categories", icon: "M3 6h6l2 2h10v10H3z" },
  { href: "/jobs", label: "Jobs", icon: "M12 6v6l4 2M12 3a9 9 0 110 18 9 9 0 010-18z" },
  { href: "/runs", label: "Runs", icon: "M5 4v16l14-8z" },
  { href: "/matching", label: "Matching", icon: "M8 7h8M8 12h8M8 17h5M4 4h16v16H4z" },
];

// Secondary pages, pinned to the bottom of the sidebar.
const BOTTOM_ITEMS: Item[] = [
  { href: "/data", label: "Other data", icon: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" },
];

const BELL_ICON = "M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9zM13.7 21a2 2 0 01-3.4 0";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Icon({ d, className = "size-4" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("shrink-0", className)} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NavLink({ item, pathname, className }: { item: Item; pathname: string; className?: string }) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition",
        active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        className,
      )}
    >
      <Icon d={item.icon} />
      {item.label}
    </Link>
  );
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto pb-1 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0">
      {ITEMS.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}
      {BOTTOM_ITEMS.map((item, i) => (
        <NavLink key={item.href} item={item} pathname={pathname} className={i === 0 ? "lg:mt-auto" : undefined} />
      ))}
    </nav>
  );
}

export function NotificationBell({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();
  const active = isActive(pathname, "/notifications");
  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <Link
      href="/notifications"
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={cx(
        "relative flex size-8 shrink-0 items-center justify-center rounded-lg transition",
        active ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      <Icon d={BELL_ICON} className="size-5" />
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-indigo-600 px-1 text-center text-[10px] font-semibold leading-4 text-white ring-2 ring-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
