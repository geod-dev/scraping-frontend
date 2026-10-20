"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

const TONES = {
  success: { main: "bg-emerald-600 text-white hover:bg-emerald-500", edge: "border-emerald-500/60" },
  danger: { main: "bg-rose-600 text-white hover:bg-rose-500", edge: "border-rose-500/60" },
};

export type SplitButtonItem = { label: string; hint?: string; onSelect: () => void; disabled?: boolean };

// Large solid button with a chevron on its right that opens a drop-up menu of variants of the
// same action (e.g. "Validate with comment"). The menu closes on outside click and Escape.
export function SplitButton({
  tone,
  label,
  shortcut,
  onClick,
  disabled,
  title,
  items,
  menuLabel,
}: {
  tone: keyof typeof TONES;
  label: ReactNode;
  // Single-key shortcut shown inside the button.
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  items: SplitButtonItem[];
  menuLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const styles = TONES[tone];
  const base =
    "inline-flex h-12 items-center justify-center text-sm font-semibold shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div ref={root} className="relative flex flex-1 sm:flex-none">
      <button type="button" className={cx(base, styles.main, "flex-1 gap-2 rounded-l-lg px-5")} onClick={onClick} disabled={disabled} title={title}>
        {label}
        {shortcut ? (
          <kbd className="hidden rounded border border-white/40 px-1.5 font-sans text-[11px] font-medium leading-4 text-white/90 md:inline">{shortcut}</kbd>
        ) : null}
      </button>
      <button
        type="button"
        className={cx(base, styles.main, styles.edge, "w-10 rounded-r-lg border-l")}
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={items.every((i) => i.disabled)}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className={cx("size-4 transition", open && "rotate-180")} aria-hidden>
          <path fillRule="evenodd" d="M14.77 12.79a.75.75 0 0 1-1.06-.02L10 8.83l-3.71 3.94a.75.75 0 1 1-1.08-1.04l4.25-4.5a.75.75 0 0 1 1.08 0l4.25 4.5a.75.75 0 0 1-.02 1.06Z" clipRule="evenodd" />
        </svg>
      </button>
      {open ? (
        <div role="menu" className="fade-up absolute bottom-full right-0 z-10 mb-2 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              <span className="font-medium text-slate-900">{item.label}</span>
              {item.hint ? <span className="mt-0.5 block text-xs text-slate-500">{item.hint}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
