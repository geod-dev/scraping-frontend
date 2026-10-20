"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult } from "@/lib/action-result";

type Props<T> = {
  // Server action that takes one serializable input object.
  action: (input: T) => Promise<ActionResult<unknown>>;
  input: T;
  label: ReactNode;
  icon?: ReactNode;
  pendingLabel?: string;
  // Asks for confirmation first (title of the dialog; `confirmMessage` details it).
  confirmTitle?: string;
  confirmMessage?: ReactNode;
  confirmLabel?: string;
  successMessage?: string;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  disabled?: boolean;
  // Shown as a tooltip, e.g. why the button is disabled.
  title?: string;
  className?: string;
  // Navigate here after success instead of refreshing (e.g. after deleting the current item).
  redirectTo?: string;
  // Navigate to what the action created (e.g. the new job) when it reports one.
  followResult?: boolean;
};

export function ActionButton<T>({
  action,
  input,
  label,
  icon,
  pendingLabel,
  confirmTitle,
  confirmMessage,
  confirmLabel,
  successMessage,
  variant = "outline",
  size = "lg",
  disabled,
  title,
  className,
  redirectTo,
  followResult,
}: Props<T>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();

  async function run() {
    if (confirmTitle && !(await confirm({ title: confirmTitle, message: confirmMessage, confirmLabel, tone: variant === "destructive" ? "danger" : "primary" }))) return;
    startTransition(async () => {
      const result = await action(input);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (successMessage) toast.success(successMessage);
      const target = (followResult && result.redirectTo) || redirectTo;
      if (target) router.push(target);
      else router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={run} disabled={disabled || pending} title={title} className={className}>
        {pending ? <Spinner /> : icon}
        {pending ? (pendingLabel ?? label) : label}
      </Button>
      {confirmDialog}
    </>
  );
}
