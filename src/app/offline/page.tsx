import type { Metadata } from "next";
import { BrandMark } from "@/components/app/brand";
import { ReloadButton } from "./reload-button";

export const metadata: Metadata = { title: "Offline" };
export const dynamic = "force-static";

// Cached by the service worker and shown when there is no connection. Contains no user data.
export default function OfflinePage() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center bg-ground px-6 text-center">
      <BrandMark className="size-12" />
      <h1 className="mt-6 text-[22px] font-semibold">You&apos;re offline</h1>
      <p className="mt-2 max-w-xs text-[15px] text-muted-foreground">
        Rentora needs a connection to show your bills and payments. Check your data or Wi-Fi, then try again.
      </p>
      <ReloadButton />
    </main>
  );
}
