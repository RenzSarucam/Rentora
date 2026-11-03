import type { z } from "zod";

export type FieldErrors = Record<string, string>;
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: FieldErrors): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function validationFail(error: z.ZodError): ActionResult<never> {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fail("Please check the highlighted fields.", fieldErrors);
}

// Friendly text for constraint names that can surface from the database.
const CONSTRAINT_MESSAGES: Record<string, string> = {
  rooms_code_unique: "A room with this number already exists in this property.",
  beds_label_unique: "A bed with this label already exists in this room.",
  assignments_one_current_per_bed: "This bed is already occupied.",
  assignments_one_current_per_member: "This boarder already has a bed.",
  invoices_one_rent_per_period: "A rent invoice for this month already exists.",
  submissions_reference_unique: "This transaction reference was already submitted.",
  organization_members_one_org_per_user: "This email already belongs to an account.",
  payments_submission_id_key: "This payment was already posted.",
};

// Codes whose messages are written by us in the SQL functions and are safe to show.
const USER_FACING_CODES = new Set(["23514", "22023", "23505", "P0001"]);

export type DbError = { code?: string; message?: string } | null | undefined;

/** Turns a Postgres/PostgREST error into text safe for the UI. Never leaks internals. */
export function dbErrorMessage(error: DbError): string {
  if (!error) return "Something went wrong. Please try again.";
  const message = error.message ?? "";
  for (const [constraint, text] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (message.includes(constraint)) return text;
  }
  if (error.code === "42501") return "You do not have permission to do that.";
  if (error.code === "23503") return "That record no longer exists or is in use.";
  if (error.code && USER_FACING_CODES.has(error.code) && message && !message.includes("violates")) return message;
  if (error.code === "23514" || error.code === "22P02") return "Some values are not allowed. Please check and try again.";
  return "Something went wrong. Please try again.";
}

export function dbFail(error: DbError): ActionResult<never> {
  return fail(dbErrorMessage(error));
}
