import { describe, expect, it } from "vitest";
import { readEmailSession } from "./email-link";

const credentials = "access_token=test-access-token&refresh_token=test-refresh-token&token_type=bearer";

describe("default email link sessions", () => {
  it.each(["invite", "recovery"])("sends %s links to password setup regardless of next", (type) => {
    expect(readEmailSession(`#${credentials}&type=${type}`, "/admin/dashboard")).toEqual({
      access_token: "test-access-token", refresh_token: "test-refresh-token", destination: "/auth/set-password",
    });
  });

  it("preserves a safe destination for email confirmations", () => {
    expect(readEmailSession(`#${credentials}&type=email`, "/boarder/home")?.destination).toBe("/boarder/home");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", null])("rejects an unsafe or missing next: %s", (next) => {
    expect(readEmailSession(`#${credentials}&type=email`, next)?.destination).toBe("/");
  });

  it.each([
    "", "type=invite", "type=invite&access_token=test-access-token", "type=invite&refresh_token=test-refresh-token",
    `${credentials}&type=unsupported`, `${credentials}&type=invite&error=access_denied`,
    `${credentials}&type=invite&error_code=otp_expired`,
    "access_token=test-access-token&refresh_token=test-refresh-token&type=invite&token_type=other",
  ])("rejects missing, expired or unsupported session data: %s", (fragment) => {
    expect(readEmailSession(`#${fragment}`, "/")).toBeNull();
  });
});
