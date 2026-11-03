import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A plain link: a full page load is what retries the network after being offline. */
export function ReloadButton() {
  return (
    <a href="/boarder/home" className={cn(buttonVariants(), "mt-6 h-12 rounded-xl px-6 text-[15px]")}>
      Try again
    </a>
  );
}
