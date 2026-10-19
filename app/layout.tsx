import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SidebarNav } from "@/components/nav";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Competitor Catalog",
    template: "%s · Competitor Catalog",
  },
  description: "Monitor competitor catalogs, prices, scraping jobs and matches.",
  robots: { index: false, follow: false },
};

// Every page reads live data from the scraper API, so nothing is prerendered at build time.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 font-sans text-slate-900">
        <div className="min-h-screen lg:flex">
          <aside className="border-b border-slate-200 bg-white px-4 py-4 lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
            <div className="mb-4 flex items-center gap-2.5 px-2 lg:mb-8">
              <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
                CC
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold">Competitor Catalog</p>
                <p className="text-xs text-slate-500">Scraper console</p>
              </div>
            </div>
            <SidebarNav />
          </aside>
          <main className="min-w-0 flex-1 lg:pl-60">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
