import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

/** A real POST form: works without JavaScript and is origin-checked by the route handler. */
export function SignOutButton({ className, label = "Sign out" }: { className?: string; label?: string }) {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className={cn(
          "inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-active hover:text-foreground",
          className,
        )}
      >
        <LogOut className="size-4" aria-hidden />
        {label}
      </button>
    </form>
  );
}
