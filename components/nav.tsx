"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Overview", icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { href: "/competitors", label: "Competitors", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/products", label: "Products", icon: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8" },
  { href: "/categories", label: "Categories", icon: "M3 6h6l2 2h10v10H3z" },
  { href: "/jobs", label: "Jobs", icon: "M12 6v6l4 2M12 3a9 9 0 110 18 9 9 0 010-18z" },
  { href: "/runs", label: "Runs", icon: "M5 4v16l14-8z" },
  { href: "/matching", label: "Matching", icon: "M8 7h8M8 12h8M8 17h5M4 4h16v16H4z" },
  { href: "/notifications", label: "Notifications", icon: "M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9zM13.7 21a2 2 0 01-3.4 0" },
];

export function SidebarNav({ unreadNotifications = 0 }: { unreadNotifications?: number }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
      {ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              "flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition " +
              (active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")
            }
          >
            <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
              <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {item.label}
            {item.href === "/notifications" && unreadNotifications > 0 ? (
              <span className="ml-auto rounded-full bg-indigo-600 px-1.5 text-xs font-semibold leading-5 text-white">
                {unreadNotifications > 99 ? "99+" : unreadNotifications}
                <span className="sr-only"> unread</span>
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
