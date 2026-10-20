import Link from "next/link";
import { Badge } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import type { Notification } from "@/lib/types";

const linkClass = "text-indigo-600 hover:text-indigo-500";

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Links to what a notification is about. Matching and auto-resume kinds get a direct action;
// `competitorKey` resolves `competitor_id` for links filtered by competitor.
export function NotificationLinks({ notification: n, competitorKey }: { notification: Notification; competitorKey?: string }) {
  const scope = competitorKey ? `?competitor=${competitorKey}` : "";
  const links: React.ReactNode[] = [];

  if (n.kind === "matching_summary") {
    const review = count(n.data.needs_review);
    links.push(
      <Link key="review" href={`/matching/review${scope}`} className={`${linkClass} font-medium`}>
        {review ? `Review ${formatNumber(review)} product${review > 1 ? "s" : ""} →` : "Review queue →"}
      </Link>,
    );
  } else if (n.kind === "matches_deprecated") {
    const deprecated = count(n.data.count);
    links.push(
      <Link key="deprecated" href={`/matching/deprecated${scope}`} className={`${linkClass} font-medium`}>
        {deprecated ? `${formatNumber(deprecated)} obsolete match${deprecated > 1 ? "es" : ""} →` : "Obsolete matches →"}
      </Link>,
    );
  } else if (n.kind === "job_auto_resumed" && n.job_id) {
    const from = count(n.data.resumed_from_job_id);
    links.push(
      <Link key="new-job" href={`/jobs/${n.job_id}`} className={`${linkClass} font-medium`}>
        New job #{n.job_id} →
      </Link>,
    );
    if (from) {
      links.push(
        <Link key="from" href={`/jobs/${from}`} className={linkClass}>
          Interrupted job #{from}
        </Link>,
      );
    }
  } else if (n.kind === "job_auto_resume_stopped") {
    links.push(<Badge key="manual" tone="danger">Manual action required</Badge>);
    if (n.job_id) {
      links.push(
        <Link key="job" href={`/jobs/${n.job_id}`} className={`${linkClass} font-medium`}>
          Check the worker, then restart job #{n.job_id} →
        </Link>,
      );
    }
  } else if (n.job_id) {
    links.push(
      <Link key="job" href={`/jobs/${n.job_id}`} className={linkClass}>
        Job #{n.job_id}
      </Link>,
    );
  }

  if (n.scrape_run_id) {
    links.push(
      <Link key="run" href={`/runs/${n.scrape_run_id}`} className={linkClass}>
        Run #{n.scrape_run_id}
      </Link>,
    );
  }
  if ((n.kind === "matching_summary" || n.kind === "matches_deprecated") && n.job_id) {
    links.push(
      <Link key="job" href={`/jobs/${n.job_id}`} className={linkClass}>
        Job #{n.job_id}
      </Link>,
    );
  }

  if (links.length === 0) return null;
  return <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">{links}</div>;
}
