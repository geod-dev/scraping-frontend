"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Left/right arrows (or k/j) open the previous/next item, unless the user is typing.
export function KeyboardNav({ prevHref, nextHref }: { prevHref: string | null; nextHref: string | null }) {
  const router = useRouter();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if ((event.key === "ArrowRight" || event.key === "j") && nextHref) router.push(nextHref);
      else if ((event.key === "ArrowLeft" || event.key === "k") && prevHref) router.push(prevHref);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevHref, nextHref, router]);

  return null;
}
