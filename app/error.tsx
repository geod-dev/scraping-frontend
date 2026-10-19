"use client";

import { useEffect } from "react";
import { primaryButton } from "@/components/ui";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto mt-16 max-w-lg rounded-xl border border-rose-200 bg-white p-8 text-center shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-rose-600">Something went wrong</p>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">This page could not be displayed</h1>
      <p className="mt-2 text-sm text-slate-600">The scraper API may be busy or unreachable. Try again in a moment.</p>
      {error.digest ? <p className="mt-3 font-mono text-xs text-slate-400">Reference: {error.digest}</p> : null}
      <button type="button" onClick={() => reset()} className={`${primaryButton} mt-6`}>
        Try again
      </button>
    </div>
  );
}
