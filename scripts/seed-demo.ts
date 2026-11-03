/**
 * DEVELOPMENT ONLY. Seeds a demo boarding house with confirmed demo logins so you can click through the app.
 * Refuses to run unless --dev is passed AND the project URL is local, or --i-understand-this-is-not-production is passed.
 *
 *   npm run seed:demo -- --dev
 *
 * Logins (password for all: DemoPass2026):
 *   admin@demo.rentora        landlord
 *   boarder1@demo.rentora    boarder (Room 101, Bed A)
 *   boarder2@demo.rentora   boarder (Room 101, Bed B)
 */
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

const PASSWORD = "DemoPass2026";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secret = process.env.SUPABASE_SECRET_KEY ?? "";
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

async function user(admin: SupabaseClient, email: string, fullName: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
}

async function signedIn(email: string): Promise<SupabaseClient> {
  const client = createClient(url, publishable, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return client;
}

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function main() {
  const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url);
  if (!process.argv.includes("--dev") || (!local && !process.argv.includes("--i-understand-this-is-not-production"))) {
    console.error("Refusing to seed. This script is for local/dev projects only (see header).");
    process.exit(1);
  }
  if (!url || !secret || !publishable) throw new Error("Missing Supabase env vars.");
  const admin = createClient(url, secret, { auth: { persistSession: false } });

  const ownerId = await user(admin, "admin@demo.rentora", "Maria Santos");
  const orgId = await must(
    admin.rpc("provision_organization", {
      p_name: "Santos Boarding House",
      p_property_name: "P. Noval house",
      p_property_address: "1147 P. Noval St, Sampaloc, Manila",
      p_owner: ownerId,
      p_owner_name: "Maria Santos",
      p_owner_email: "admin@demo.rentora",
    }),
    "provision",
  );
  const owner = await signedIn("admin@demo.rentora");
  const property = (await must(owner.from("properties").select("id").single<{ id: string }>(), "property"))!;

  const roomSpecs = [
    { code: "101", floor: "Ground", capacity: 2, rate: 450000 },
    { code: "102", floor: "Ground", capacity: 4, rate: 300000 },
    { code: "201", floor: "2nd", capacity: 2, rate: 500000 },
    { code: "202", floor: "2nd", capacity: 3, rate: 350000 },
  ];
  for (const r of roomSpecs) {
    await must(owner.rpc("create_room", { p_property: property.id, p_code: r.code, p_floor: r.floor, p_capacity: r.capacity, p_rate_centavos: r.rate, p_notes: "" }), "room");
  }
  const beds = (await must(
    owner.from("beds").select("id, label, monthly_rate_centavos, rooms(code)").order("label").returns<{ id: string; label: string; monthly_rate_centavos: number; rooms: { code: string } }[]>(),
    "beds",
  ))!;
  const bed = (room: string, label: string) => beds.find((b) => b.rooms.code === room && b.label === label)!;

  const boarders = [
    { email: "boarder1@demo.rentora", name: "Ana Reyes", room: "101", bed: "Bed A", moveIn: "2026-06-01" },
    { email: "boarder2@demo.rentora", name: "Paolo Cruz", room: "101", bed: "Bed B", moveIn: "2026-07-15" },
    { email: "jasmine.villanueva@demo.rentora.test", name: "Jasmine Villanueva", room: "102", bed: "Bed A", moveIn: "2026-06-01" },
    { email: "kevin.delarosa@demo.rentora.test", name: "Kevin dela Rosa", room: "102", bed: "Bed B", moveIn: "2026-08-01" },
    { email: "mika.bautista@demo.rentora.test", name: "Mika Bautista", room: "201", bed: "Bed A", moveIn: "2026-09-01" },
  ];
  const members: Record<string, string> = {};
  for (const b of boarders) {
    const userId = await user(admin, b.email, b.name);
    const memberId = await must(
      admin.rpc("register_boarder_invitation", { p_org: orgId, p_user: userId, p_email: b.email, p_full_name: b.name, p_phone: "0917 555 0101", p_invited_by: ownerId }),
      "register",
    );
    members[b.email] = memberId as string;
    const client = await signedIn(b.email);
    await must(client.rpc("accept_invitation"), "accept");
    const target = bed(b.room, b.bed);
    await must(owner.rpc("assign_bed", { p_member: memberId, p_bed: target.id, p_move_in: b.moveIn, p_rent_centavos: target.monthly_rate_centavos }), "assign");
  }

  await must(owner.rpc("generate_monthly_invoices", { p_org: orgId, p_period: "2026-09-01", p_due: "2026-09-05" }), "gen sep");
  await must(owner.rpc("generate_monthly_invoices", { p_org: orgId, p_period: "2026-10-01", p_due: "2026-10-05" }), "gen oct");

  // September fully paid by everyone; October partly paid.
  for (const b of boarders) {
    const sep = await must(
      owner.from("invoices").select("id, total_centavos").eq("member_id", members[b.email]).eq("period_month", "2026-09-01").maybeSingle<{ id: string; total_centavos: number }>(),
      "sep invoice",
    );
    if (sep) await must(owner.rpc("record_payment", { p_member: members[b.email], p_amount_centavos: sep.total_centavos, p_method: "cash", p_reference: "", p_received_on: "2026-09-04", p_notes: "", p_invoice: sep.id }), "pay sep");
  }
  await must(owner.rpc("record_payment", { p_member: members["boarder1@demo.rentora"], p_amount_centavos: 450000, p_method: "gcash", p_reference: "GC-8841-2207", p_received_on: "2026-10-03", p_notes: "", p_invoice: null }), "pay oct");
  await must(owner.rpc("record_payment", { p_member: members["jasmine.villanueva@demo.rentora.test"], p_amount_centavos: 150000, p_method: "cash", p_reference: "", p_received_on: "2026-10-06", p_notes: "Partial", p_invoice: null }), "partial oct");

  await must(
    owner.from("announcements").insert({
      organization_id: orgId,
      title: "Water interruption on Saturday",
      body: "Maynilad will cut water supply this Saturday from 9 AM to 3 PM. Please store water the night before.",
      pinned: true,
      published_at: new Date().toISOString(),
    }),
    "announcement",
  );
  const paolo = await signedIn("boarder2@demo.rentora");
  await must(
    paolo.from("maintenance_requests").insert({ member_id: members["boarder2@demo.rentora"], title: "Aircon not cooling", description: "The aircon in Room 101 runs but blows warm air since Tuesday.", priority: "normal" }),
    "maintenance",
  );

  console.log("Demo data ready. Sign in with admin@demo.rentora / " + PASSWORD);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
