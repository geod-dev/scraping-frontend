"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

// Elements inside a row that keep their own click behaviour.
const INTERACTIVE = "a, button, input, select, textarea, label, summary, [data-row-ignore]";

// Table row that opens `href` when clicked anywhere. Links, buttons and fields inside keep
// working; Ctrl/Cmd/middle click open a new tab; selecting text does not navigate. Keyboard
// and screen reader users reach the same page through the link in the row's first cell.
export function LinkRow({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const router = useRouter();

  function open(event: MouseEvent<HTMLTableRowElement>, newTab: boolean) {
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
    if (window.getSelection()?.toString()) return;
    if (newTab) window.open(href, "_blank", "noopener");
    else router.push(href);
  }

  return (
    <tr
      className={cx("cursor-pointer transition-colors hover:bg-indigo-50/40", className)}
      onClick={(e) => open(e, e.metaKey || e.ctrlKey || e.shiftKey)}
      onAuxClick={(e) => {
        if (e.button === 1) open(e, true);
      }}
      onMouseEnter={() => router.prefetch(href)}
    >
      {children}
    </tr>
  );
}
