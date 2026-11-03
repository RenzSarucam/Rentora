import { cn } from "@/lib/utils";

/** An empty block keeps its frame and says one plain sentence, with the next step if there is one. */
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-dashed border-control/70 px-6 py-10 text-center", className)}>
      <p className="text-[15px] font-medium text-foreground">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
