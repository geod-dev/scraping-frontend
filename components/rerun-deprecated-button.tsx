"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { rerunDeprecated } from "@/app/actions";
import { useConfirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

// Queues one "obsolete only" matching job per competitor having obsolete matches, then
// reports what was started, refused and skipped in a toast.
export function RerunDeprecatedButton({ competitor, disabled, variant = "default" }: { competitor?: string; disabled?: boolean; variant?: "default" | "outline" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();

  async function run() {
    const scope = competitor ? `for ${competitor}` : "for every competitor";
    if (!(await confirm({ title: `Recompute all obsolete matches ${scope}?`, message: "One “obsolete only” matching job is queued per competitor.", confirmLabel: "Recompute" }))) return;
    startTransition(async () => {
      const response = await rerunDeprecated({ competitor });
      if (!response.ok) {
        toast.error(response.message);
        return;
      }
      const result = response.data;
      const started = result?.jobs ?? [];
      const details = [
        ...(result?.refused ?? []).map((r) => `Refused · ${r.competitor_key}: ${r.message}`),
        result?.nothing_to_do.length ? `Nothing to do: ${result.nothing_to_do.join(", ")}` : null,
      ].filter(Boolean);
      const description = details.join("\n") || undefined;
      if (started.length > 0) {
        toast.success(`${started.length} job${started.length > 1 ? "s" : ""} started: ${started.map((j) => `#${j.id} (${j.competitor_key})`).join(", ")}`, {
          description,
          action: { label: "Open", onClick: () => router.push(started.length === 1 ? `/jobs/${started[0].id}` : "/jobs?active=1") },
        });
      } else {
        toast.warning("No job started", { description });
      }
      router.refresh();
    });
  }

  return (
    <>
      <Button size="lg" variant={variant} onClick={run} disabled={disabled || pending}>
        {pending ? <Spinner /> : <RefreshCwIcon />}
        {pending ? "Starting…" : "Rerun all obsolete"}
      </Button>
      {confirmDialog}
    </>
  );
}
