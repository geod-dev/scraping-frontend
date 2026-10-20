import { cookies } from "next/headers";
import { AppSidebar } from "@/components/app-sidebar";
import { LiveProvider } from "@/components/live";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

// The sidebar gets its live state from the event stream (LiveProvider), so the layout never
// waits on the API and navigations stay instant.
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";

  return (
    <LiveProvider>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AppSidebar />
        {/* overflow-x-clip keeps the full-bleed sticky header background inside the column. */}
        <SidebarInset className="min-w-0 overflow-x-clip">
          <div className="flex h-12 items-center gap-2 border-b bg-background px-4 md:hidden">
            <SidebarTrigger />
            <span className="text-sm font-semibold">Competitor Catalog</span>
          </div>
          <div className="mx-auto w-full max-w-7xl px-4 pt-6 pb-10 sm:px-6 lg:px-8">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </LiveProvider>
  );
}
