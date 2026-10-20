"use client";

import { useLayoutEffect, useRef, useState } from "react";

// Text clamped to a few lines, with a "Read more" toggle shown only when it overflows.
export function ReadMore({ text, lines = 4, className = "" }: { text: string; lines?: number; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text, lines, open]);

  return (
    <div className={className}>
      <p
        ref={ref}
        className="whitespace-pre-line text-sm text-slate-700"
        style={open ? undefined : { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" }}
      >
        {text}
      </p>
      {overflows || open ? (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-500">
          {open ? "Show less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}
