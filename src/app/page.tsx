import { redirect } from "next/navigation";
import { getViewer, homeFor } from "@/lib/auth/session";

export default async function Index() {
  const viewer = await getViewer();
  redirect(viewer ? homeFor(viewer) : "/login");
}
