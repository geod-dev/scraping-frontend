"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

// Per-browser review conveniences: the reviewer name and a count of the decisions taken today.
// Browser storage may be unavailable (private mode, blocked site data): every access is guarded
// and the screen works without it.

const NAME_KEY = "matching.decidedBy";
const STATS_KEY = "matching.reviewStats";
const CHANGE_EVENT = "matching:storage";
// Fired by the decision bar once a decision is saved, before moving on.
export const DECIDED_EVENT = "matching:decided";
export const MILESTONE_EVERY = 10;

export type Outcome = "validated" | "rejected" | "reset";
export type DecidedDetail = { outcome: Outcome; leaving: boolean };

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function useStored(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
}

export function useReviewerName(): [string, (name: string) => void] {
  const name = useStored(NAME_KEY) ?? "";
  return [name, (value: string) => write(NAME_KEY, value.trim())];
}

type Stats = { day: string; today: number; total: number };

const today = () => new Date().toLocaleDateString("en-CA");

function parseStats(raw: string | null): Stats {
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<Stats>) : {};
    const total = Number(parsed.total) || 0;
    return parsed.day === today() ? { day: parsed.day, today: Number(parsed.today) || 0, total } : { day: today(), today: 0, total };
  } catch {
    return { day: today(), today: 0, total: 0 };
  }
}

// Counts one decision; returns today's count so the caller can celebrate milestones.
export function recordReview(): number {
  const stats = parseStats(read(STATS_KEY));
  const next = { day: stats.day, today: stats.today + 1, total: stats.total + 1 };
  write(STATS_KEY, JSON.stringify(next));
  return next.today;
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// Small pill with the reviews decided today on this browser, and the progress to the next
// milestone as a thin bar.
export function SessionCounter() {
  const raw = useStored(STATS_KEY);
  const stats = parseStats(raw);
  const toMilestone = stats.today % MILESTONE_EVERY;
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 shadow-sm"
      title={`Decisions taken on this browser: ${stats.today} today, ${stats.total} in total`}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5 text-emerald-600" aria-hidden>
        <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4l3.3 3.29 7.3-7.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
      </svg>
      <span className="tabular-nums">
        <span className="font-semibold text-slate-900">{stats.today}</span> today
      </span>
      <span className="h-1 w-10 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <span className="block h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${(toMilestone / MILESTONE_EVERY) * 100}%` }} />
      </span>
    </span>
  );
}

// Wraps the review content; slides it out when a decision moves on to the next product.
// Keyed by product in the page, so it starts fresh on every product.
export function ReviewStage({ children }: { children: ReactNode }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    function onDecided(event: Event) {
      if ((event as CustomEvent<DecidedDetail>).detail.leaving) setLeaving(true);
    }
    window.addEventListener(DECIDED_EVENT, onDecided);
    return () => window.removeEventListener(DECIDED_EVENT, onDecided);
  }, []);
  return <div className={leaving ? "review-leaving" : undefined}>{children}</div>;
}
