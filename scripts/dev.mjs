import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { isIPv4 } from "node:net";
import { networkInterfaces } from "node:os";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const args = process.argv.slice(2);
const portIndex = args.findIndex((arg) => arg === "--port" || arg === "-p");
const inlinePort = args.find((arg) => arg.startsWith("--port="))?.slice("--port=".length);
const port = Number(inlinePort ?? (portIndex >= 0 ? args[portIndex + 1] : process.env.PORT ?? 3000));
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid dev port.");

const isPrivate = (ip) => /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(ip);
const addresses = Object.entries(networkInterfaces())
  .filter(([name]) => !/virtual|vmware|vbox|vethernet|wsl|docker|tailscale|loopback|^tun|^tap/i.test(name))
  .flatMap(([name, entries]) => (entries ?? [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal && isPrivate(entry.address))
    .map((entry) => ({ name, ip: entry.address })))
  .sort((a, b) => Number(!/wi-?fi|wlan|ethernet|^en\d/i.test(a.name)) - Number(!/wi-?fi|wlan|ethernet|^en\d/i.test(b.name)));

const host = process.env.RENTORA_DEV_HOST ?? addresses[0]?.ip ?? "localhost";
if (host !== "localhost" && (!isIPv4(host) || !isPrivate(host))) {
  throw new Error("RENTORA_DEV_HOST must be a private IPv4 address or localhost.");
}
const siteURL = `http://${host}:${port}`;
const callbackURL = `${siteURL}/auth/confirm`;

// Match email redirects to the LAN address without rewriting .env.local or touching production.
async function syncDevAuth() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const supabaseURL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!token || !supabaseURL) {
    console.warn(`Supabase Auth: allow ${callbackURL} before testing email links.`);
    return;
  }
  const hostname = new URL(supabaseURL).hostname;
  if (!/^[a-z0-9-]+\.supabase\.co$/.test(hostname)) return;
  const endpoint = `https://api.supabase.com/v1/projects/${hostname.split(".")[0]}`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const request = async (path, options) => {
    const response = await fetch(`${endpoint}${path}`, { ...options, headers, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error("Dev Auth configuration request failed.");
    return response.json();
  };
  const project = await request("");
  if (project.name !== "rentora-dev") {
    console.warn("Automatic Auth URL setup only applies to rentora-dev.");
    return;
  }
  const current = await request("/config/auth");
  const currentHost = new URL(current.site_url ?? siteURL).hostname;
  if (currentHost !== "localhost" && (!isIPv4(currentHost) || !isPrivate(currentHost))) {
    console.warn("Automatic Auth URL setup skipped: this project has a hosted Site URL.");
    return;
  }
  const redirects = new Set((current.uri_allow_list ?? "").split(",").map((url) => url.trim()).filter(Boolean));
  if (current.site_url === siteURL && redirects.has(callbackURL)) return;
  redirects.add(callbackURL);
  await request("/config/auth", {
    method: "PATCH",
    body: JSON.stringify({ site_url: siteURL, uri_allow_list: [...redirects].join(",") }),
  });
  console.log(`Dev Auth URL: ${siteURL}`);
}

try {
  await syncDevAuth();
} catch {
  console.warn(`Could not sync dev Auth URLs. Allow ${callbackURL} in the Supabase dashboard before testing email links.`);
}

console.log(`Rentora LAN: ${siteURL}`);
const require = createRequire(import.meta.url);
const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "--hostname", "0.0.0.0", "--port", String(port), ...args], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_SITE_URL: siteURL, RENTORA_DEV_HOST: host, PORT: String(port) },
});
child.on("error", () => { console.error("Could not start the dev server."); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { child.kill(signal); });
