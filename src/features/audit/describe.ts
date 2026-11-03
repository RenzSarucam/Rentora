// Readable text for audit log action codes written by the database (RPCs and the generic row trigger).

const ACTIONS: Record<string, string> = {
  "organization.provisioned": "Set up the account",
  "organizations.update": "Changed business settings",
  "properties.insert": "Added a property",
  "properties.update": "Edited a property",
  "properties.delete": "Deleted a property",
  "rooms.insert": "Added a room",
  "rooms.update": "Edited a room",
  "rooms.delete": "Deleted a room",
  "beds.insert": "Added a bed",
  "beds.update": "Edited a bed",
  "beds.delete": "Deleted a bed",
  "organization_members.insert": "Added a member",
  "organization_members.update": "Updated a member",
  "invitation.sent": "Invited a boarder",
  "invitation.accepted": "Accepted an invitation",
  "assignment.created": "Assigned a bed",
  "assignment.ended": "Recorded a move-out",
  "assignment.transferred": "Moved a boarder to another bed",
  "invoices.generated": "Generated monthly invoices",
  "invoice.created": "Created an invoice",
  "invoice.item_added": "Added a charge or discount",
  "invoice.item_removed": "Removed a charge or discount",
  "invoice.voided": "Voided an invoice",
  "payment.recorded": "Recorded a payment",
  "payment.voided": "Voided a payment",
  "payment_submission.created": "Submitted a payment for review",
  "payment_submission.approved": "Approved a payment",
  "payment_submission.rejected": "Rejected a payment",
  "maintenance_requests.insert": "Filed a maintenance request",
  "maintenance.status_changed": "Changed a maintenance status",
  "announcements.insert": "Created an announcement",
  "announcements.update": "Edited an announcement",
  "announcements.delete": "Deleted an announcement",
};

export function describeAction(action: string): string {
  if (ACTIONS[action]) return ACTIONS[action];
  const [entity, verb] = action.split(".");
  const noun = (entity ?? action).replace(/_/g, " ").replace(/s$/, "");
  return verb ? `${verb.replace(/_/g, " ")} ${noun}`.replace(/^\w/, (c) => c.toUpperCase()) : action;
}

const ENTITY_LINKS: Record<string, (id: string) => string> = {
  rooms: (id) => `/admin/rooms/${id}`,
  invoices: (id) => `/admin/billing/${id}`,
  maintenance_requests: (id) => `/admin/maintenance/${id}`,
  organization_members: (id) => `/admin/boarders/${id}`,
  payments: (id) => `/receipts/${id}`,
};

export function entityLink(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  return ENTITY_LINKS[entityType]?.(entityId) ?? null;
}

/** Changed column names from row-trigger metadata, humanized: "monthly_rate_centavos" -> "monthly rate". */
export function changedFields(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object" || !("changed" in metadata)) return [];
  const changed = (metadata as { changed: unknown }).changed;
  if (!Array.isArray(changed)) return [];
  return changed.filter((c): c is string => typeof c === "string").map((c) => c.replace(/_centavos$/, "").replace(/_at$/, "").replace(/_/g, " "));
}
