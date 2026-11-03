import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { connection } from "next/server";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: { default: "Rentora", template: "%s · Rentora" },
  description: "Boarding house management: rooms, beds, boarders, billing and payments.",
  applicationName: "Rentora",
  appleWebApp: { capable: true, title: "Rentora", statusBarStyle: "default" },
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/favicon.ico?v=house-r", type: "image/x-icon", sizes: "16x16 32x32 48x48" },
      { url: "/icons/favicon.svg?v=house-r", type: "image/svg+xml", sizes: "any" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f5f1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Render every page per request so Next.js can stamp the CSP nonce from src/proxy.ts onto its scripts.
  await connection();
  return (
    <html lang="en-PH" className={`${plexSans.variable} ${plexMono.variable} h-full`}>
      <body className="min-h-full">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
