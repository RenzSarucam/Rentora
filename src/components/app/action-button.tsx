"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";

type Props<T> = {
  action: (input: T) => Promise<ActionResult<unknown>>;
  input: T;
  children: React.ReactNode;
  confirm?: { title: string; description: React.ReactNode; confirmLabel: string; destructive?: boolean };
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  disabled?: boolean;
};

/** Runs a server action with feedback. With `confirm`, asks first (for archive/void/approve). */
export function ActionButton<T>({ action, input, children, confirm, variant = "outline", size, className, disabled }: Props<T>) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const run = () =>
    startTransition(async () => {
      const result = await action(input);
      if (result.ok) {
        if (result.message) toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });

  const button = (
    <Button type="button" variant={variant} size={size} className={className} disabled={pending || disabled} aria-busy={pending} onClick={confirm ? undefined : run}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );

  if (!confirm) return button;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{button}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirm.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              run();
            }}
            disabled={pending}
            className={confirm.destructive ? "bg-negative text-white hover:bg-negative/90" : undefined}
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {confirm.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
