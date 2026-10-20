import Link from "next/link";

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

const TABS = [{ href: "/data/dimensionless", label: "Dimensionless" }];

export function DataTabs({ active }: { active: string }) {
  return (
    <nav aria-label="Other data" className="-mt-4 mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === active ? "page" : undefined}
          className={cx(
            "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition",
            tab.href === active ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-900",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
