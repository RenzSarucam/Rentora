import { BrandMark } from "@/components/app/brand";
import { BRAND_HOUSE_PATH } from "@/lib/brand-artwork";

/** Whole-app fallback; CSS reveals the logo only if startup takes over 800 ms. */
export function RouteLoading() {
  return (
    <div role="status" aria-label="Loading Rentora" className="rentora-loading fixed inset-0 z-[100] grid place-items-center bg-ground">
      <BrandMark className="rentora-loading-mark size-20 sm:size-24">
        <g transform="translate(32 32) scale(1.14) translate(-32 -32)" fill="none" stroke="currentColor" strokeWidth="1.25">
          <path d={BRAND_HOUSE_PATH} className="text-border" />
          <path d={BRAND_HOUSE_PATH} pathLength="100" strokeDasharray="18 82"
            strokeLinecap="round" className="rentora-loading-trace text-foreground" />
        </g>
      </BrandMark>
      <span className="sr-only">Loading Rentora…</span>
    </div>
  );
}
