"use client";

import { createContext, useContext, useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { labelize } from "@/lib/format";
import type { ConsoleSummary, Job, LiveEvent, LiveEventType } from "@/lib/types";

// Live console state from the API's server-sent events (relayed by /api/events). One stream
// per tab feeds the sidebar summary, the progress of active jobs (updated in place, without
// re-rendering the server page) and targeted page refreshes when the data behind a page
// changes. The browser reconnects by itself; after a refused connection we retry with backoff.

const EVENT_TYPES: LiveEventType[] = ["console.summary", "job.updated", "job.finished", "notification.created", "matching.updated", "competitor.updated"];
const RETRY_MIN_MS = 3_000;
const RETRY_MAX_MS = 60_000;

export type Connection = "connecting" | "open" | "offline";
// `statusChanged`: a job.updated/job.finished event moved a job to another status (or is its first event).
type Listener = (event: LiveEvent, meta: { statusChanged: boolean }) => void;

const SummaryContext = createContext<ConsoleSummary | null>(null);
const JobsContext = createContext<ReadonlyMap<number, Job>>(new Map());
const ConnectionContext = createContext<Connection>("connecting");
const ListenersContext = createContext<Set<Listener>>(new Set());

export function LiveProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<ConsoleSummary | null>(null);
  const [jobs, setJobs] = useState<ReadonlyMap<number, Job>>(new Map());
  const [connection, setConnection] = useState<Connection>("connecting");
  const [listeners] = useState(() => new Set<Listener>());
  const statuses = useRef(new Map<number, Job["status"]>());

  const receive = useEffectEvent((event: LiveEvent) => {
    let statusChanged = false;
    if (event.type === "console.summary") {
      setSummary(event.data);
      // Seed the live jobs so progress shows before their first update.
      setJobs((current) => {
        const next = new Map(current);
        for (const job of event.data.jobs) if (!next.has(job.id)) next.set(job.id, job);
        return next;
      });
      for (const job of event.data.jobs) if (!statuses.current.has(job.id)) statuses.current.set(job.id, job.status);
    } else if (event.type === "job.updated" || event.type === "job.finished") {
      const job = event.data;
      statusChanged = statuses.current.get(job.id) !== job.status;
      statuses.current.set(job.id, job.status);
      setJobs((current) => new Map(current).set(job.id, job));
    }
    for (const listener of listeners) listener(event, { statusChanged });
  });

  useEffect(() => {
    let source: EventSource | null = null;
    let retry: number | undefined;
    let delay = RETRY_MIN_MS;

    function connect() {
      setConnection("connecting");
      source = new EventSource("/api/events");
      source.onopen = () => {
        delay = RETRY_MIN_MS;
        setConnection("open");
      };
      source.onerror = () => {
        // CONNECTING: the browser retries by itself. CLOSED: the server refused, retry later.
        if (source?.readyState === EventSource.CLOSED) {
          setConnection("offline");
          source.close();
          retry = window.setTimeout(connect, delay);
          delay = Math.min(RETRY_MAX_MS, delay * 2);
        } else {
          setConnection("connecting");
        }
      };
      for (const type of EVENT_TYPES) {
        source.addEventListener(type, (message) => {
          try {
            receive({ type, data: JSON.parse((message as MessageEvent<string>).data) } as LiveEvent);
          } catch {
            // Ignore a malformed event rather than breaking the stream.
          }
        });
      }
    }

    connect();
    return () => {
      window.clearTimeout(retry);
      source?.close();
    };
  }, []);

  return (
    <ListenersContext.Provider value={listeners}>
      <ConnectionContext.Provider value={connection}>
        <SummaryContext.Provider value={summary}>
          <JobsContext.Provider value={jobs}>
            <LiveToasts />
            {children}
          </JobsContext.Provider>
        </SummaryContext.Provider>
      </ConnectionContext.Provider>
    </ListenersContext.Provider>
  );
}

export function useConsoleSummary(): ConsoleSummary | null {
  return useContext(SummaryContext);
}

export function useLiveConnection(): Connection {
  return useContext(ConnectionContext);
}

// The latest state of a job: its live updates once they arrive, else what the page rendered.
export function useLiveJob<T extends Job | null | undefined>(job: T): T {
  const jobs = useContext(JobsContext);
  return (job ? (jobs.get(job.id) ?? job) : job) as T;
}

export function useLiveEvent(handler: Listener) {
  const listeners = useContext(ListenersContext);
  const onEvent = useEffectEvent(handler);
  useEffect(() => {
    const listener: Listener = (event, meta) => onEvent(event, meta);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [listeners]);
}

const REFRESH_DEBOUNCE_MS = 800;

// Re-renders the server page when the data it shows changes: a job of the page changes
// status (started, paused, finished), match counts change, a notification arrives. Narrowed
// to a competitor or a job when given. Bursts of events cause one refresh.
export function LiveRefresh({
  on,
  competitor,
  jobId,
}: {
  on: ("job.status" | "matching.updated" | "notification.created" | "competitor.updated")[];
  competitor?: string;
  jobId?: number;
}) {
  const router = useRouter();
  const timer = useRef<number | undefined>(undefined);

  useLiveEvent((event, { statusChanged }) => {
    const key = event.type === "competitor.updated" ? event.data.key : "competitor_key" in event.data ? event.data.competitor_key : null;
    const relevant =
      ((event.type === "job.updated" || event.type === "job.finished") && statusChanged && on.includes("job.status") && (jobId === undefined || event.data.id === jobId)) ||
      (event.type === "matching.updated" && on.includes("matching.updated")) ||
      (event.type === "notification.created" && on.includes("notification.created")) ||
      (event.type === "competitor.updated" && on.includes("competitor.updated"));
    if (!relevant || (competitor && key && key !== competitor)) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
  });

  useEffect(() => () => window.clearTimeout(timer.current), []);
  return null;
}

const FINISH_TOASTS: Record<string, "success" | "warning" | "error" | "info"> = {
  succeeded: "success",
  partial: "warning",
  failed: "error",
  interrupted: "warning",
  cancelled: "info",
};

// Finished jobs and new warnings or errors surface as toasts on every page.
function LiveToasts() {
  const router = useRouter();
  useLiveEvent((event) => {
    if (event.type === "job.finished") {
      const job = event.data;
      toast[FINISH_TOASTS[job.status] ?? "info"](`${labelize(job.task)} ${labelize(job.status).toLowerCase()}`, {
        description: `${job.competitor_key} · job #${job.id}`,
        action: { label: "Open", onClick: () => router.push(`/jobs/${job.id}`) },
      });
    } else if (event.type === "notification.created" && (event.data.level === "error" || event.data.level === "warning")) {
      const n = event.data;
      toast[n.level === "error" ? "error" : "warning"](n.title, {
        description: n.message ?? undefined,
        action: { label: "Inbox", onClick: () => router.push("/notifications?unread=1") },
      });
    }
  });
  return null;
}
