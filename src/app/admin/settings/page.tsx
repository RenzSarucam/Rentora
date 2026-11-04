import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ActionButton } from "@/components/app/action-button";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";
import { archiveProperty } from "@/features/settings/actions";
import { getSettings } from "@/features/settings/queries";
import { getPaymentReceivingAccounts } from "@/features/settings/payment-queries";
import { PaymentReceivingForm } from "@/features/settings/payment-receiving-form";
import { propertyLocation } from "@/features/settings/location";
import { OrganizationForm, PasswordResetButton, PropertyDialog } from "@/features/settings/settings-forms";
import { requireStaff } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

function Section({ title, description, children }: { title: string; description: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-border py-8 first:pt-0 last:border-0 lg:grid-cols-[minmax(0,360px)_1fr] lg:gap-10">
      <div>
        <h2 className="text-base font-medium">{title}</h2>
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      </div>
      <div className="min-w-0 rounded-2xl bg-raised p-5">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const viewer = await requireStaff();
  const { org, properties, team } = await getSettings(viewer.orgId);
  const receivingAccounts = viewer.role === "owner" ? await getPaymentReceivingAccounts(viewer.orgId) : [];
  const activeProperties = properties.filter((p) => !p.archivedAt);
  const location = propertyLocation(activeProperties.map((property) => property.address));

  return (
    <>
      <PageHeader title="Settings" description={[org.name, location, org.currency].filter(Boolean).join(" · ")} />

      <Section title="Business" description="How your boarding house appears to boarders, and when rent is due by default.">
        <OrganizationForm org={org} />
      </Section>

      {viewer.role === "owner" && (
        <Section title="Payment receiving details" description="Add your GCash and receiving-bank QR images. Boarders pay in their own app and send proof for your approval.">
          <div className="grid gap-8 xl:grid-cols-2">
            {(["gcash", "bank_transfer"] as const).map((method) => {
              const account = receivingAccounts.find((row) => row.method === method);
              return <PaymentReceivingForm key={`${method}-${account?.qrUrl ?? "new"}`} method={method} account={account} />;
            })}
          </div>
        </Section>
      )}

      <Section
        title="Properties"
        description={`${activeProperties.length} active. A property must have no rooms before it can be archived.`}
      >
        <ul className="grid gap-0">
          {properties.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 first:pt-0 last:border-0 last:pb-0">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {p.name}
                  {p.archivedAt && <StatusPill tone="neutral">Archived</StatusPill>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.address || "No address"} · <span className="num">{p.activeRooms}</span> room{p.activeRooms === 1 ? "" : "s"}
                </p>
              </div>
              {!p.archivedAt && (
                <div className="flex gap-1">
                  <PropertyDialog property={p} />
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    action={archiveProperty}
                    input={{ id: p.id }}
                    disabled={p.activeRooms > 0 || activeProperties.length <= 1}
                    confirm={{
                      title: `Archive ${p.name}?`,
                      description: "It will no longer be offered when adding rooms. Its history is kept.",
                      confirmLabel: "Archive",
                      destructive: true,
                    }}
                  >
                    Archive
                  </ActionButton>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <PropertyDialog />
        </div>
      </Section>

      <Section
        title="Team"
        description="Owners and admins can see and change everything here. New staff accounts are added by Rentora support so access stays controlled."
      >
        <ul className="grid gap-0">
          {team.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 border-b border-border py-3 first:pt-0 last:border-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.name}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              <StatusPill tone="neutral">{m.role === "owner" ? "Owner" : "Admin"}</StatusPill>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Your account" description={<>Signed in as <span className="text-foreground">{viewer.email}</span>.</>}>
        <p className="mb-3 text-sm text-muted-foreground">We will email you a link to choose a new password. The link expires after one use.</p>
        <PasswordResetButton email={viewer.email} />
      </Section>

      <Section title="Activity log" description="Every change to rooms, billing, payments and boarders, with who made it.">
        <Link href="/admin/settings/audit" className="flex items-center justify-between text-sm font-medium hover:underline">
          View the activity log
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </Section>
    </>
  );
}
