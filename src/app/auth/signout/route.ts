import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/security/origin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Keep the browser's origin: the dev server's internal URL may use 0.0.0.0.
  return new NextResponse(null, { status: 303, headers: { Location: "/login" } });
}
