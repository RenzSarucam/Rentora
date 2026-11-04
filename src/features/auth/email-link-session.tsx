"use client";

import { useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { RouteLoading } from "@/components/app/route-loading";
import { publicEnv } from "@/lib/env";
import { readEmailSession } from "./email-link";

export function EmailLinkSession({ fallback }: { fallback?: string }) {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const url = new URL(window.location.href);
    const session = readEmailSession(url.hash, url.searchParams.get("next"));
    const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
    const hasEmailFragment = ["access_token", "refresh_token", "type", "error", "error_code"].some((key) => fragment.has(key));
    // Remove credentials from browser history before making requests or navigating.
    window.history.replaceState(window.history.state, "", url.pathname);
    if (!session) {
      window.location.replace(fallback && !hasEmailFragment ? fallback : "/login?error=link");
      return;
    }

    const complete = async () => {
      try {
        const env = publicEnv();
        const supabase = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
          auth: { detectSessionInUrl: false },
        });
        const { error } = await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
        // A full navigation lets the server validate the new session and enforce authorization.
        window.location.replace(error ? "/login?error=link" : session.destination);
      } catch {
        window.location.replace("/login?error=link");
      }
    };
    void complete();
  }, [fallback]);

  if (fallback) return <RouteLoading />;

  return (
    <>
      <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Opening your sign-in link</h1>
      <p role="status" className="mt-2 text-sm text-muted-foreground">Please wait while we verify your email.</p>
    </>
  );
}
