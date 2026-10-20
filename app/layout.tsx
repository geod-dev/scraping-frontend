import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
      <body className="min-h-full bg-slate-50 font-sans text-slate-900">{children}</body>
    </html>
  );
}
