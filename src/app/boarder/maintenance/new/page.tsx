import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { MaintenanceForm } from "@/features/boarder/maintenance-form";
import { Card, ScreenTitle } from "@/features/boarder/ui";
import { requireBoarder } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Report a problem" };

export default async function NewMaintenancePage() {
  const viewer = await requireBoarder();
  if (viewer.status === "archived") redirect("/boarder/maintenance");
  return (
    <>
      <Link href="/boarder/maintenance" className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Repairs
      </Link>
      <ScreenTitle sub="Your landlord sees this right away.">Report a problem</ScreenTitle>
      <Card>
        <MaintenanceForm />
      </Card>
    </>
  );
}
