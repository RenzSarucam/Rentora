"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff, type Viewer } from "@/lib/auth/session";
import { dbFail, fail, ok, validationFail, type ActionResult } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cleanupBoarderUploads } from "./deletion-cleanup";
import { deleteBoarderSchema, finishDeletionSchema } from "./schemas";

type Result = ActionResult<{ cleanupPending: boolean }>;
const PENDING = "Boarder records deleted. Use Finish deletion below to complete file and login cleanup.";

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/boarder", "layout");
}

async function finish(viewer: Viewer, jobId: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("boarder_deletion_jobs", { p_job: jobId });
  if (error) return dbFail(error);
  const job = (data as { organization_id: string; member_id: string; status: string }[] | null)?.[0];
  if (!job || job.organization_id !== viewer.orgId) return fail("Deletion not found.");
  if (job.status === "complete") return ok({ cleanupPending: false }, "Boarder deletion is complete.");
  if (job.status !== "cleanup_pending") return fail("This deletion is not ready for cleanup.");

  // The owner-scoped RPC has already removed this membership and its records.
  // Service role is used only to remove orphan uploads under its exact prefix.
  const cleaned = await cleanupBoarderUploads(createAdminClient().storage, job.organization_id, job.member_id);
  if (!cleaned) return ok({ cleanupPending: true }, PENDING);
  const completed = await supabase.rpc("complete_boarder_deletion", { p_job: jobId });
  if (completed.error) {
    console.error("boarder deletion cleanup pending", completed.error.code ?? "unknown");
    return ok({ cleanupPending: true }, PENDING);
  }
  return ok({ cleanupPending: false }, "Boarder, login and linked data permanently deleted.");
}

export async function deleteBoarder(input: unknown): Promise<ActionResult<never>> {
  const viewer = await requireStaff();
  if (viewer.role !== "owner") return fail("Only the owner can permanently delete a boarder.");
  const parsed = deleteBoarderSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_boarder", {
    p_member: parsed.data.memberId,
    p_confirmation_email: parsed.data.confirmationEmail,
  });
  if (error) return dbFail(error);
  // After commit, a failed cleanup must not imply the business rows still exist.
  let cleanupPending = true;
  try {
    const result = await finish(viewer, data as string);
    if (result.ok) cleanupPending = result.data.cleanupPending;
  } catch {
    console.error("boarder deletion cleanup interrupted");
  }
  refresh();
  redirect(`/admin/boarders?deletion=${cleanupPending ? "pending" : "complete"}`);
}

export async function finishBoarderDeletion(input: unknown): Promise<Result> {
  const viewer = await requireStaff();
  if (viewer.role !== "owner") return fail("Only the owner can finish a boarder deletion.");
  const parsed = finishDeletionSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  try {
    const result = await finish(viewer, parsed.data.jobId);
    if (result.ok) refresh();
    return result;
  } catch {
    console.error("boarder deletion cleanup interrupted");
    return fail("Cleanup could not finish. Try Finish deletion again.");
  }
}
