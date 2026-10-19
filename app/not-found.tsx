import Link from "next/link";
import { primaryButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">404</p>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600">The item you are looking for does not exist or was removed.</p>
      <Link href="/" className={`${primaryButton} mt-6`}>
        Back to overview
      </Link>
    </div>
  );
}
