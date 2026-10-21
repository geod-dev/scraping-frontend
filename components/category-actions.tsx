"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BanIcon, DatabaseZapIcon, EllipsisIcon, GitCompareArrowsIcon, TagIcon, TriangleAlertIcon, Undo2Icon } from "lucide-react";
import { toast } from "sonner";
import { banCategory, unbanCategory } from "@/app/actions";
import { ActionErrorNotice, Notice } from "@/components/kit";
import { useReviewerName } from "@/components/review-session";
import { TaskDialog } from "@/components/task-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatDeleted, formatNumber } from "@/lib/format";
import type { BannedCategory, TaskName } from "@/lib/types";

// Jobs limited to one category (sync, price refresh, matching) and its ban, from a menu of the
// category tree or the category page; unban from the banned categories list.

export type CategoryTarget = {
  id: number;
  name: string;
  competitorKey: string;
  competitorName: string;
  // The competitor is the reference catalog (Antalis): never matched, and banning one of its
  // categories makes matches of the other competitors obsolete.
  isReference: boolean;
};

// What a ban deletes. `direct`: `subcategories` counts the direct children only.
export type BanImpact = { subcategories: number; direct: boolean; products: number };

type Action = TaskName | "ban";

const ITEMS: { action: Action; label: string; icon: typeof DatabaseZapIcon }[] = [
  { action: "catalog_sync", label: "Scrape this category…", icon: DatabaseZapIcon },
  { action: "price_refresh", label: "Refresh its prices…", icon: TagIcon },
  { action: "matching", label: "Match this category…", icon: GitCompareArrowsIcon },
];

// "⋯" menu of a category: its jobs, then the ban. `busyReason` disables the jobs.
export function CategoryMenu({
  category,
  impact,
  busyReason,
  afterBanHref,
  actions = ["catalog_sync", "price_refresh", "matching", "ban"],
  size = "icon-sm",
}: {
  category: CategoryTarget;
  impact: BanImpact;
  busyReason?: string | null;
  // Where to go once the category is banned (it no longer exists); refreshes when absent.
  afterBanHref?: string;
  actions?: Action[];
  size?: "icon-sm" | "icon-lg";
}) {
  const [open, setOpen] = useState<Action | null>(null);
  const items = ITEMS.filter((i) => actions.includes(i.action) && !(i.action === "matching" && category.isReference));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size={size} aria-label={`Actions on ${category.name}`} title="Actions">
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {items.map(({ action, label, icon: Icon }) => (
            <DropdownMenuItem key={action} disabled={Boolean(busyReason)} onSelect={() => setOpen(action)} title={busyReason ?? undefined}>
              <Icon />
              {label}
            </DropdownMenuItem>
          ))}
          {busyReason && items.length > 0 ? <p className="px-2 py-1 text-xs text-muted-foreground">{busyReason}</p> : null}
          {actions.includes("ban") ? (
            <>
              {items.length > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem variant="destructive" onSelect={() => setOpen("ban")}>
                <BanIcon />
                Ban this category…
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {open && open !== "ban" ? (
        <TaskDialog
          open
          onOpenChange={(next) => !next && setOpen(null)}
          competitorKey={category.competitorKey}
          competitorName={category.competitorName}
          task={open}
          category={{ id: category.id, name: category.name }}
        />
      ) : null}
      {open === "ban" ? <BanDialog open onOpenChange={(next) => !next && setOpen(null)} category={category} impact={impact} afterBanHref={afterBanHref} /> : null}
    </>
  );
}

// Visible "Ban" button of the category page.
export function BanCategoryButton({ category, impact, afterBanHref }: { category: CategoryTarget; impact: BanImpact; afterBanHref?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="lg" variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setOpen(true)}>
        <BanIcon />
        Ban
      </Button>
      {open ? <BanDialog open onOpenChange={setOpen} category={category} impact={impact} afterBanHref={afterBanHref} /> : null}
    </>
  );
}

const plural = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`;

// Destructive confirmation: says what goes, asks for the category name typed in full.
function BanDialog({
  open,
  onOpenChange,
  category,
  impact,
  afterBanHref,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryTarget;
  impact: BanImpact;
  afterBanHref?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, saveName] = useReviewerName();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<{ message: string; jobId?: number } | null>(null);
  const confirmed = typed.trim().toLocaleLowerCase("fr") === category.name.trim().toLocaleLowerCase("fr");
  const bannedHref = `/categories/banned?competitor=${encodeURIComponent(category.competitorKey)}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed) return;
    const data = new FormData(event.currentTarget);
    const reason = String(data.get("reason") ?? "").trim() || undefined;
    const bannedBy = String(data.get("bannedBy") ?? "").trim() || undefined;
    setError(null);
    startTransition(async () => {
      const result = await banCategory({ id: category.id, reason, bannedBy });
      if (!result.ok) {
        setError({ message: result.message, jobId: result.jobId });
        return;
      }
      if (bannedBy && bannedBy !== name) saveName(bannedBy);
      onOpenChange(false);
      toast.warning(`“${category.name}” banned`, {
        description: `Deleted: ${formatDeleted(result.data?.deleted)}.`,
        duration: 20_000,
        action: { label: "Banned categories", onClick: () => router.push(bannedHref) },
      });
      if (afterBanHref) router.push(afterBanHref);
      else router.refresh();
    });
  }

  const subcategories =
    impact.subcategories === 0
      ? null
      : impact.direct
        ? `its ${plural(impact.subcategories, "sub-category", "sub-categories")} and everything below them`
        : `its ${plural(impact.subcategories, "sub-category", "sub-categories")}`;

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="flex-row items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlertIcon className="size-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <DialogTitle className="text-base">Ban “{category.name}”?</DialogTitle>
            <DialogDescription>
              {category.competitorName} · this permanently deletes data and cannot be undone.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <Notice tone="danger" title="Deleted now, for good">
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>
                The category{subcategories ? <>, {subcategories}</> : null}
              </li>
              <li>
                <strong>{plural(impact.products, "product", "products")}</strong> with their whole price history
              </li>
              <li>Their matches and match history</li>
            </ul>
          </Notice>

          {category.isReference ? (
            <Notice tone="danger" title="This is the Antalis reference catalog">
              Every match of the other competitors associated with (or proposing) one of these {plural(impact.products, "product", "products")} becomes
              obsolete (“Antalis product deleted”) and has to be matched and reviewed again.
            </Notice>
          ) : null}

          <Notice tone="warning" title="Skipped by every catalog sync">
            The category will not come back with the next syncs. Unbanning it later recreates it empty, under a new id: its products, prices and
            matches have to be scraped and reviewed again.
          </Notice>

          <div className="space-y-1.5">
            <Label htmlFor="ban-reason">Reason</Label>
            <Textarea id="ban-reason" name="reason" placeholder="Optional: out of scope, not our market… (shown in the banned list)" maxLength={1000} className="h-16" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ban-by">Your name</Label>
            <Input id="ban-by" name="bannedBy" defaultValue={name} placeholder="Optional" maxLength={100} autoComplete="name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ban-confirm">
              Type <strong className="font-semibold">{category.name}</strong> to confirm
            </Label>
            <Input id="ban-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} aria-invalid={typed !== "" && !confirmed} autoFocus />
          </div>

          {error ? (
            <ActionErrorNotice title="The category was not banned" error={error} />
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!confirmed || pending}>
              {pending ? <Spinner /> : <BanIcon />}
              {pending ? "Banning…" : impact.products > 0 ? `Ban and delete ${plural(impact.products, "product", "products")}` : "Ban the category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// "Unban" of a banned category, with the option to scrape it right away.
export function UnbanButton({ ban }: { ban: Pick<BannedCategory, "id" | "name" | "category_id" | "competitor_key"> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scrape, setScrape] = useState(true);
  const [pending, startTransition] = useTransition();
  const [name] = useReviewerName();
  const [error, setError] = useState<{ message: string; jobId?: number } | null>(null);

  function unban() {
    setError(null);
    startTransition(async () => {
      const result = await unbanCategory({ banId: ban.id, scrape, unbannedBy: name || undefined });
      if (!result.ok) {
        setError({ message: result.message, jobId: result.jobId });
        return;
      }
      setOpen(false);
      const created = result.data;
      // The category has a new id: link to that one, never to the old one.
      const href = created?.job ? `/jobs/${created.job.id}` : created ? `/categories/${created.category.id}` : null;
      toast.success(`“${ban.name}” unbanned`, {
        description: created?.job ? "Its catalog sync is queued." : "It is back, empty: the next catalog sync fills it.",
        action: href ? { label: created?.job ? "Open job" : "Open category", onClick: () => router.push(href) } : undefined,
      });
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Undo2Icon />
        Unban
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unban “{ban.name}”?</DialogTitle>
            <DialogDescription>
              The category is recreated empty, under a new id (it was #{ban.category_id}), and the catalog syncs include it again. What the ban deleted
              does not come back: it has to be scraped again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2">
            <Checkbox id={`unban-scrape-${ban.id}`} checked={scrape} onCheckedChange={(v) => setScrape(v === true)} className="mt-0.5" />
            <Label htmlFor={`unban-scrape-${ban.id}`} className="font-normal leading-snug">
              Scrape it now: queue a catalog sync of this category (uses scraping credits; if the worker is busy, nothing is unbanned)
            </Label>
          </div>
          {error ? (
            <ActionErrorNotice title="The category was not unbanned" error={error} />
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" onClick={unban} disabled={pending}>
              {pending ? <Spinner /> : <Undo2Icon />}
              {pending ? "Unbanning…" : scrape ? "Unban and scrape" : "Unban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
