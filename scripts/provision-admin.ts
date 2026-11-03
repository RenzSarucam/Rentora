/**
 * Controlled admin provisioning. Public sign-up is disabled, so landlord accounts are created here.
 *
 *   npm run provision:admin -- --email owner@example.ph --name "Maria Santos" \
 *     --org "Santos Boarding House" --property "Main house" --address "123 P. Noval St, Sampaloc, Manila" --confirm
 *
 * Sends a Supabase invitation email; the owner sets their own password from the link.
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and NEXT_PUBLIC_SITE_URL from .env.local (or the environment).
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim();
  const org = arg("org")?.trim();
  const property = arg("property")?.trim() || "Main house";
  const address = arg("address")?.trim() || "";
  if (!email || !name || !org) {
    console.error("Usage: npm run provision:admin -- --email <email> --name <full name> --org <organization> [--property <name>] [--address <address>] --confirm");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url || !key || !site) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and NEXT_PUBLIC_SITE_URL first.");
    process.exit(1);
  }

  console.log(`Target Supabase project: ${url}`);
  console.log(`Will invite ${email} as owner of "${org}".`);
  if (!process.argv.includes("--confirm")) {
    console.log("Dry run. Re-run with --confirm to send the invitation.");
    return;
  }

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name },
    redirectTo: `${site}/auth/confirm`,
  });
  if (error || !data.user) {
    console.error(`Invitation failed: ${error?.message ?? "no user returned"}`);
    process.exit(1);
  }

  const { data: orgId, error: rpcError } = await admin.rpc("provision_organization", {
    p_name: org,
    p_property_name: property,
    p_property_address: address,
    p_owner: data.user.id,
    p_owner_name: name,
    p_owner_email: email,
  });
  if (rpcError) {
    console.error(`Organization setup failed (${rpcError.code}). Removing the unconfirmed invite.`);
    await admin.auth.admin.deleteUser(data.user.id);
    process.exit(1);
  }
  console.log(`Done. Organization ${orgId} created; invitation sent to ${email}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Unexpected error");
  process.exit(1);
});
