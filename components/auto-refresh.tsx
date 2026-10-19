"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-renders the current server page on an interval while `enabled` is true.
export function AutoRefresh({ enabled, intervalMs = 3000 }: { enabled: boolean; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => router.refresh(), intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs, router]);

  return enabled ? (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
      Live
    </span>
  ) : null;
}
