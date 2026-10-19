"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";

type Props<T> = {
  // Server action that takes one serializable input object.
  action: (input: T) => Promise<ActionResult>;
  input: T;
  label: string;
  pendingLabel?: string;
  confirmMessage?: string;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  className?: string;
  // Navigate here after success instead of refreshing (e.g. after deleting the current item).
  redirectTo?: string;
};

const VARIANTS = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-500",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  danger: "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
};

export function ActionButton<T>({
  action,
  input,
  label,
  pendingLabel,
  confirmMessage,
  variant = "secondary",
  disabled,
  className = "",
  redirectTo,
}: Props<T>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setError(null);
    startTransition(async () => {
      const result = await action(input);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={disabled || pending}
        className={`inline-flex h-9 items-center justify-center rounded-md px-3.5 text-sm font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      >
        {pending ? (pendingLabel ?? "Working…") : label}
      </button>
      {error ? <span className="max-w-xs text-xs text-rose-700">{error}</span> : null}
    </span>
  );
}
