import { describe, expect, it } from "vitest";
import { centavosToInput, formatPeso, parsePesoToCentavos } from "./money";
import { addMonths, daysBetween, dueDateFor, isIsoDate, manilaToday, monthStart } from "./dates";
import { sniffFileType, checkUpload, storagePath, MAX_UPLOAD_BYTES } from "./uploads";
import { dbErrorMessage } from "./errors";
import { isSameOrigin, safeNextPath } from "./security/origin";
import { buildCsp } from "./security/csp";
import { password, pesoAmount } from "./validation";

describe("money", () => {
  it.each([
    ["3500", 350000],
    ["3,500.5", 350050],
    ["₱ 3,500.05", 350005],
    ["0.1", 10],
    ["0.29", 29],
    [1234.56, 123456],
  ])("parses %s to %i centavos", (input, expected) => {
    expect(parsePesoToCentavos(input)).toBe(expected);
  });

  it.each(["", "-5", "1.234", "abc", "1e5", "12,34.5.6", "9999999999"])("rejects %s", (input) => {
    expect(parsePesoToCentavos(input)).toBeNull();
  });

  it("formats PHP", () => {
    expect(formatPeso(350050)).toBe("₱3,500.50");
    expect(formatPeso(null)).toBe("—");
    expect(centavosToInput(350000)).toBe("3500.00");
  });

  it("validates peso amounts in schemas", () => {
    expect(pesoAmount().safeParse("0").success).toBe(false);
    expect(pesoAmount({ allowZero: true }).parse("0")).toBe(0);
    expect(pesoAmount().safeParse("2000000").success).toBe(false);
  });
});

describe("dates", () => {
  it("uses Manila's calendar day, not UTC's", () => {
    // 2026-10-31 17:30 UTC is already Nov 1 in Manila (UTC+8).
    expect(manilaToday(new Date("2026-10-31T17:30:00Z"))).toBe("2026-11-01");
    expect(manilaToday(new Date("2026-10-31T15:59:00Z"))).toBe("2026-10-31");
  });

  it("does month arithmetic", () => {
    expect(monthStart("2026-10-31")).toBe("2026-10-01");
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
    expect(dueDateFor("2027-02-01", 30)).toBe("2027-02-28");
    expect(daysBetween("2026-10-01", "2026-10-05")).toBe(4);
  });

  it("validates ISO dates", () => {
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-10-1")).toBe(false);
  });
});

describe("upload restrictions", () => {
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pdf = new TextEncoder().encode("%PDF-1.7");
  const html = new TextEncoder().encode("<html><script>alert(1)</script>");

  it("identifies files by content", () => {
    expect(sniffFileType(jpg)?.mime).toBe("image/jpeg");
    expect(sniffFileType(png)?.mime).toBe("image/png");
    expect(sniffFileType(pdf)?.mime).toBe("application/pdf");
    expect(sniffFileType(html)).toBeNull();
  });

  it("rejects a script renamed to .jpg", async () => {
    const file = new File([html], "proof.jpg", { type: "image/jpeg" });
    expect(await checkUpload(file, ["image/jpeg", "image/png"])).toMatchObject({ ok: false });
  });

  it("rejects PDFs where only images are allowed", async () => {
    const file = new File([pdf], "photo.pdf", { type: "application/pdf" });
    expect(await checkUpload(file, ["image/jpeg"])).toMatchObject({ ok: false });
  });

  it("rejects oversized and empty files", async () => {
    const big = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "big.jpg");
    expect(await checkUpload(big, ["image/jpeg"])).toMatchObject({ ok: false, error: "File is larger than 4 MB." });
    expect(await checkUpload(new File([], "e.jpg"), ["image/jpeg"])).toMatchObject({ ok: false });
    expect(await checkUpload("not a file", ["image/jpeg"])).toMatchObject({ ok: false });
  });

  it("accepts a real image and names it randomly inside the member folder", async () => {
    const res = await checkUpload(new File([jpg], "../../etc/passwd.png"), ["image/jpeg"]);
    expect(res).toMatchObject({ ok: true, type: { ext: "jpg" } });
    expect(storagePath("org", "mem", "jpg")).toMatch(/^org\/mem\/[0-9a-f-]{36}\.jpg$/);
  });
});

describe("error messages", () => {
  it("maps constraints to friendly text and hides internals", () => {
    expect(dbErrorMessage({ code: "23505", message: 'duplicate key value violates unique constraint "submissions_reference_unique"' })).toBe(
      "This transaction reference was already submitted.",
    );
    expect(dbErrorMessage({ code: "23514", message: "Room capacity of 3 beds reached" })).toBe("Room capacity of 3 beds reached");
    expect(dbErrorMessage({ code: "42P01", message: 'relation "secret_table" does not exist' })).toBe("Something went wrong. Please try again.");
    expect(dbErrorMessage({ code: "42501", message: "permission denied for table invoices" })).toBe("You do not have permission to do that.");
  });
});

describe("request security helpers", () => {
  const req = (headers: Record<string, string>) => new Request("https://app.example/x", { method: "POST", headers });

  it("requires a matching Origin for route handlers", () => {
    expect(isSameOrigin(req({ origin: "https://app.example", host: "app.example" }))).toBe(true);
    expect(isSameOrigin(req({ origin: "https://evil.example", host: "app.example" }))).toBe(false);
    expect(isSameOrigin(req({ host: "app.example" }))).toBe(false);
  });

  it.each([
    ["/boarder/bills", "/boarder/bills"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["https://evil.example", "/"],
    [null, "/"],
  ])("safeNextPath(%s) = %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it("builds a strict production CSP", () => {
    const csp = buildCsp("abc", false);
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("enforces the password policy", () => {
    expect(password.safeParse("short1A").success).toBe(false);
    expect(password.safeParse("alllowercase123").success).toBe(false);
    expect(password.safeParse("GoodPassword2026").success).toBe(true);
  });
});
