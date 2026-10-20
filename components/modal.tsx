"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Modal dialog on the native <dialog> element: focus trap, Escape and the top layer come from
// the browser. The element marked `data-autofocus` gets the focus; a click on the backdrop
// closes it. Children render only while open, so forms inside start fresh every time.
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="modal-title"
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px]"
    >
      {open ? (
        <div className="fade-up p-5">
          <h2 id="modal-title" className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          {description ? <div className="mt-1 text-sm text-slate-600">{description}</div> : null}
          <div className="mt-4">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}
