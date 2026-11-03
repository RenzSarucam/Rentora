export function buildCsp(nonce: string, isDev: boolean): string {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseWs = supabase.replace(/^http/, "ws");
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes are used by charts and Radix positioning; scripts stay nonce-locked.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: ${supabase}`.trim(),
    `font-src 'self'`,
    `connect-src 'self' ${supabase} ${supabaseWs}`.trim(),
    `frame-src 'self' ${supabase}`.trim(),
    `worker-src 'self'`,
    `manifest-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}
