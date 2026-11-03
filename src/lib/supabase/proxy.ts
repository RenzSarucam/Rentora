import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Refreshes the Supabase session cookie on the way through and reports whether a valid session exists.
 * This is an optimistic check for redirects only; authorization happens in layouts, actions and RLS.
 */
export async function refreshSession(request: NextRequest, response: NextResponse): Promise<{ signedIn: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { signedIn: false };

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  try {
    const { data, error } = await supabase.auth.getClaims();
    return { signedIn: !error && Boolean(data?.claims?.sub) };
  } catch {
    return { signedIn: false };
  }
}
