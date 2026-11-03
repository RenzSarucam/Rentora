import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { BedView } from "./queries";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/**
 * The house at a glance: one cell per bed. Occupied beds carry the boarder's initials in teal;
 * vacant beds are an empty outline; beds under maintenance are hatched.
 */
export function BedCells({ beds, roomUnderMaintenance, size = "md" }: { beds: BedView[]; roomUnderMaintenance?: boolean; size?: "sm" | "md" }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Beds">
      {beds.map((bed) => {
        const maintenance = !bed.occupant && (bed.status === "maintenance" || roomUnderMaintenance);
        const label = bed.occupant
          ? `${bed.label}: ${bed.occupant.name}`
          : maintenance
            ? `${bed.label}: under maintenance`
            : `${bed.label}: vacant`;
        return (
          <li key={bed.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  aria-label={label}
                  className={cn(
                    "inline-flex items-center justify-center rounded-[5px] text-[11px] font-semibold num outline-offset-2",
                    size === "md" ? "h-8 w-10" : "h-6 w-8",
                    bed.occupant && "bg-teal text-white",
                    !bed.occupant && !maintenance && "border border-dashed border-control bg-background text-muted-foreground",
                    maintenance &&
                      "border border-control bg-[repeating-linear-gradient(135deg,var(--raised)_0_4px,var(--active)_4px_6px)] text-muted-foreground",
                  )}
                >
                  {bed.occupant ? initials(bed.occupant.name) : bed.label.replace(/^Bed\s+/i, "")}
                </span>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

export function BedLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-4 rounded-[3px] bg-teal" aria-hidden /> Occupied
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-4 rounded-[3px] border border-dashed border-control" aria-hidden /> Vacant
      </li>
      <li className="flex items-center gap-1.5">
        <span
          className="inline-block h-3 w-4 rounded-[3px] border border-control bg-[repeating-linear-gradient(135deg,var(--raised)_0_3px,var(--active)_3px_5px)]"
          aria-hidden
        />
        Maintenance
      </li>
    </ul>
  );
}
