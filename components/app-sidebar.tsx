"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellIcon,
  ChevronRightIcon,
  DatabaseIcon,
  FolderTreeIcon,
  GitCompareArrowsIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  Loader2Icon,
  PackageIcon,
  StoreIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useConsoleSummary, useLiveConnection, useLiveJob } from "@/components/live";
import { jobPercent } from "@/components/job-progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { formatDuration, labelize } from "@/lib/format";
import type { Job } from "@/lib/types";

const BUSY_STATES = new Set(["queued", "running", "pausing", "resuming", "stopping"]);

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function CountBadge({ value, tone = "neutral" }: { value: number | null | undefined; tone?: "neutral" | "warning" | "danger" }) {
  if (!value) return null;
  return (
    <SidebarMenuBadge
      className={cn(
        "rounded-full px-1.5",
        tone === "warning" && "bg-amber-100 text-amber-900 peer-hover/menu-button:text-amber-900",
        tone === "danger" && "bg-rose-100 text-rose-800 peer-hover/menu-button:text-rose-800",
        tone === "neutral" && "bg-sidebar-accent",
      )}
    >
      {value > 999 ? `${Math.floor(value / 1000)}k` : value}
    </SidebarMenuBadge>
  );
}

function NavItem({ href, label, icon: Icon, pathname, children }: { href: string; label: string; icon: LucideIcon; pathname: string; children?: React.ReactNode }) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive(pathname, href)} tooltip={label}>
        <Link href={href} onClick={() => setOpenMobile(false)}>
          <Icon />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
      {children}
    </SidebarMenuItem>
  );
}

// Navigation with the live state of the console: running jobs and their progress,
// competitors and their worker, what waits for a human (reviews, unread notifications).
export function AppSidebar() {
  const pathname = usePathname();
  const summary = useConsoleSummary();
  const connection = useLiveConnection();
  const { setOpenMobile } = useSidebar();
  const jobs = summary?.jobs ?? [];
  const names = new Map(summary?.competitors.map((c) => [c.key, c.name]));
  const unreadErrors = summary?.notifications.by_level.error ?? 0;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <span className="relative flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                  CC
                  <span
                    className={cn(
                      "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-sidebar",
                      connection === "open" ? "bg-emerald-500" : connection === "connecting" ? "animate-pulse bg-amber-400" : "bg-slate-400",
                    )}
                    title={connection === "open" ? "Live updates on" : connection === "connecting" ? "Connecting to live updates…" : "Live updates unavailable"}
                  />
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">Competitor Catalog</span>
                  <span className="truncate text-xs text-muted-foreground">{connection === "offline" ? "Live updates unavailable" : "Scraper console"}</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem href="/" label="Overview" icon={LayoutDashboardIcon} pathname={pathname} />

              <Collapsible asChild defaultOpen={pathname.startsWith("/competitors")}>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive(pathname, "/competitors")} tooltip="Competitors">
                    <Link href="/competitors" onClick={() => setOpenMobile(false)}>
                      <StoreIcon />
                      <span>Competitors</span>
                    </Link>
                  </SidebarMenuButton>
                  {summary && summary.competitors.length > 0 ? (
                    <>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuAction className="transition-transform data-[state=open]:rotate-90" aria-label="Show competitors">
                          <ChevronRightIcon />
                        </SidebarMenuAction>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {summary.competitors.map((c) => (
                            <SidebarMenuSubItem key={c.key}>
                              <SidebarMenuSubButton asChild isActive={isActive(pathname, `/competitors/${c.key}`)}>
                                <Link href={`/competitors/${c.key}`} onClick={() => setOpenMobile(false)}>
                                  <WorkerDot state={c.worker_state} />
                                  <span className={cn(!c.enabled && "text-muted-foreground line-through")}>{c.name}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </>
                  ) : null}
                </SidebarMenuItem>
              </Collapsible>

              <NavItem href="/products" label="Products" icon={PackageIcon} pathname={pathname} />
              <NavItem href="/categories" label="Categories" icon={FolderTreeIcon} pathname={pathname} />
              <NavItem href="/jobs" label="Jobs" icon={ListChecksIcon} pathname={pathname}>
                {jobs.length > 0 ? (
                  <SidebarMenuBadge className="gap-1 rounded-full bg-sky-100 px-1.5 text-sky-800 peer-hover/menu-button:text-sky-800">
                    <Loader2Icon className="size-3 animate-spin" aria-hidden />
                    {jobs.length}
                    <span className="sr-only">running</span>
                  </SidebarMenuBadge>
                ) : null}
              </NavItem>
              <NavItem href="/runs" label="Runs" icon={HistoryIcon} pathname={pathname} />
              <NavItem href="/matching" label="Matching" icon={GitCompareArrowsIcon} pathname={pathname}>
                <CountBadge value={summary?.matching.needs_review} tone="warning" />
              </NavItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {jobs.length > 0 ? (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>Running now</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {jobs.map((job) => (
                  <SidebarMenuItem key={job.id}>
                    <RunningJob job={job} name={names.get(job.competitor_key) ?? job.competitor_key} active={isActive(pathname, `/jobs/${job.id}`)} onOpen={() => setOpenMobile(false)} />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <NavItem href="/notifications" label="Notifications" icon={BellIcon} pathname={pathname}>
            <CountBadge value={summary?.notifications.unread} tone={unreadErrors ? "danger" : "neutral"} />
          </NavItem>
          <NavItem href="/data" label="Other data" icon={DatabaseIcon} pathname={pathname} />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function RunningJob({ job: initial, name, active, onOpen }: { job: Job; name: string; active: boolean; onOpen: () => void }) {
  const job = useLiveJob(initial);
  const percent = jobPercent(job);
  return (
    <Link href={`/jobs/${job.id}`} onClick={onOpen} className={cn("block rounded-md px-2 py-1.5 text-xs transition hover:bg-sidebar-accent", active && "bg-sidebar-accent")}>
      <span className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{name}</span>
        <span className="shrink-0 text-muted-foreground tabular-nums">{job.status === "running" ? `${Math.round(percent ?? 0)}%` : labelize(job.status)}</span>
      </span>
      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-sidebar-border">
        <span
          className={cn("block h-full rounded-full transition-all duration-700", job.status === "paused" ? "bg-amber-500" : "bg-primary", job.status === "queued" && "w-1/4 animate-pulse")}
          style={job.status === "queued" ? undefined : { width: `${Math.max(3, percent ?? 0)}%` }}
        />
      </span>
      <span className="mt-1 flex justify-between gap-2 text-muted-foreground">
        <span className="truncate">{job.step_label ?? labelize(job.task)}</span>
        {job.progress.eta_seconds ? <span className="shrink-0 tabular-nums">{formatDuration(job.progress.eta_seconds)} left</span> : null}
      </span>
    </Link>
  );
}

function WorkerDot({ state }: { state: string }) {
  const busy = BUSY_STATES.has(state);
  return (
    <span
      className={cn("size-2 shrink-0 rounded-full", busy ? "animate-pulse bg-sky-500" : state === "paused" ? "bg-amber-500" : "bg-slate-300")}
      title={`Worker ${labelize(state)}`}
      aria-label={`Worker ${labelize(state)}`}
    />
  );
}
