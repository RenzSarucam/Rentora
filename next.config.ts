import type { NextConfig } from "next";

// Static security headers. The Content-Security-Policy is per-request (nonce) and set in src/proxy.ts.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: process.env.RENTORA_DEV_HOST ? [process.env.RENTORA_DEV_HOST] : [],
  // Next dev includes action arguments by default; sign-in arguments contain passwords.
  logging: {
    serverFunctions: false,
    incomingRequests: { ignore: [/^\/auth\/confirm(?:[/?]|$)/] },
  },
  // Every screen is per-user financial data: render per request, cache nothing on the server.
  cacheComponents: false,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  experimental: {
    serverActions: {
      // Vercel caps function bodies at 4.5 MB; uploads are limited to 4 MB in src/lib/uploads.ts.
      bodySizeLimit: "4.5mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
