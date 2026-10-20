import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// The family name is spelled out in globals.css (`--font-sans`), so only the font files load here.
const inter = Inter({ subsets: ["latin"] });

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
    <html lang="en" className={`${inter.className} h-full antialiased`}>
      <body className="min-h-full bg-background font-sans text-foreground">
        <NuqsAdapter>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        </NuqsAdapter>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
