import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { changedFields, describeAction, entityLink } from "@/features/audit/describe";
import { listAudit } from "@/features/audit/queries";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Activity log" };

export default async function AuditPage() {
  const entries = await listAudit(200);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/settings", label: "Settings" }}
        title="Activity log"
        description="The latest 200 changes, newest first. Times are Philippine time. Entries cannot be edited or deleted."
      />
      {entries.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="h-10 pr-3 font-medium whitespace-nowrap">When</th>
                <th scope="col" className="px-3 font-medium">Who</th>
                <th scope="col" className="px-3 font-medium">What</th>
                <th scope="col" className="pl-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const href = entityLink(e.entityType, e.entityId);
                const fields = changedFields(e.metadata);
                return (
                  <tr key={e.id} className="border-b border-rule align-top">
                    <td className="num py-3 pr-3 whitespace-nowrap text-muted-foreground">{formatDateTime(e.createdAt)}</td>
                    <td className="px-3 py-3">{e.actor}</td>
                    <td className="px-3 py-3">
                      {href ? (
                        <Link href={href} className="hover:underline">
                          {describeAction(e.action)}
                        </Link>
                      ) : (
                        describeAction(e.action)
                      )}
                    </td>
                    <td className="py-3 pl-3 text-muted-foreground">{fields.length ? `Changed ${fields.join(", ")}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
