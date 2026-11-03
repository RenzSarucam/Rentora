import { AdminShell } from "@/components/admin/admin-shell";
import { SignOutButton } from "@/components/app/sign-out-button";
import { propertyLocation } from "@/features/settings/location";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Server-side role gate for every /admin route. RLS enforces the same rule underneath.
  const viewer = await requireStaff();
  const supabase = await createClient();
  const [pending, open, properties] = await Promise.all([
    supabase.from("payment_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("maintenance_requests").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    supabase.from("properties").select("address").eq("organization_id", viewer.orgId).is("archived_at", null).order("created_at").order("id").returns<{ address: string | null }[]>(),
  ]);

  return (
    <AdminShell
      orgName={viewer.orgName}
      orgLocation={properties.error ? null : propertyLocation((properties.data ?? []).map((property) => property.address))}
      userName={viewer.fullName}
      userEmail={viewer.email}
      pendingPayments={pending.count ?? 0}
      openRequests={open.count ?? 0}
      signOut={<SignOutButton />}
    >
      {children}
    </AdminShell>
  );
}
