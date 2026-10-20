import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { primaryButton } from "@/components/ui";
import { login } from "./actions";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  if (!process.env.DASHBOARD_PASSWORD) redirect("/");

  const { error, next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            CC
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Competitor Catalog</p>
            <p className="text-xs text-slate-500">Scraper console</p>
          </div>
        </div>

        <form action={login} className="space-y-4">
          <input type="hidden" name="next" value={next ?? "/"} />
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-rose-600">
              Incorrect password.
            </p>
          ) : null}
          <button type="submit" className={`${primaryButton} w-full`}>
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
