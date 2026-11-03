import { describe, expect, it } from "vitest";
import { changedFields, describeAction, entityLink } from "./describe";

describe("audit log text", () => {
  it("maps known actions to plain sentences", () => {
    expect(describeAction("payment_submission.approved")).toBe("Approved a payment");
    expect(describeAction("assignment.transferred")).toBe("Moved a boarder to another bed");
  });

  it("falls back to a readable form for unknown actions", () => {
    expect(describeAction("widgets.update")).toBe("Update widget");
    expect(describeAction("weird")).toBe("weird");
  });

  it("links only to known entity screens", () => {
    expect(entityLink("rooms", "abc")).toBe("/admin/rooms/abc");
    expect(entityLink("audit_logs", "abc")).toBeNull();
    expect(entityLink("rooms", null)).toBeNull();
  });

  it("humanizes changed column names and ignores bad metadata", () => {
    expect(changedFields({ changed: ["monthly_rate_centavos", "archived_at", "status"] })).toEqual(["monthly rate", "archived", "status"]);
    expect(changedFields({ changed: "x" })).toEqual([]);
    expect(changedFields(null)).toEqual([]);
  });
});
