import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listRooms } from "@/features/rooms/queries";

type Row = {
  id: string;
  member_id: string;
  bed_id: string;
  move_in_date: string;
  move_out_date: string | null;
  end_reason: string | null;
  monthly_rent_centavos: number;
  organization_members: { status: string; profiles: { full_name: string; email: string } | null } | null;
  beds: { label: string; rooms: { id: string; code: string } | null } | null;
};

export type AssignmentRow = {
  id: string;
  memberId: string;
  bedId: string;
  name: string;
  roomId: string | null;
  roomCode: string;
  bedLabel: string;
  rent: number;
  moveIn: string;
  moveOut: string | null;
  endReason: string | null;
};

export async function listAssignments(): Promise<{ current: AssignmentRow[]; past: AssignmentRow[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boarder_assignments")
    .select(
      `id, member_id, bed_id, move_in_date, move_out_date, end_reason, monthly_rent_centavos,
       organization_members(status, profiles(full_name, email)),
       beds(label, rooms(id, code))`,
    )
    .order("move_in_date", { ascending: false })
    .returns<Row[]>();
  if (error) throw new Error("Could not load assignments");

  const rows = data.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    bedId: r.bed_id,
    name: r.organization_members?.profiles?.full_name || r.organization_members?.profiles?.email || "Boarder",
    roomId: r.beds?.rooms?.id ?? null,
    roomCode: r.beds?.rooms?.code ?? "—",
    bedLabel: r.beds?.label ?? "—",
    rent: r.monthly_rent_centavos,
    moveIn: r.move_in_date,
    moveOut: r.move_out_date,
    endReason: r.end_reason,
  }));
  return {
    current: rows
      .filter((r) => r.moveOut === null)
      .sort((a, b) => a.roomCode.localeCompare(b.roomCode, undefined, { numeric: true }) || a.bedLabel.localeCompare(b.bedLabel)),
    past: rows.filter((r) => r.moveOut !== null).sort((a, b) => (b.moveOut ?? "").localeCompare(a.moveOut ?? "")),
  };
}

export type BedOption = { id: string; roomCode: string; label: string; rate: number };
export type BoarderOption = { id: string; name: string };

/** Beds that can take someone today: not occupied, bed and room active. */
export async function listVacantBeds(): Promise<BedOption[]> {
  const rooms = await listRooms();
  return rooms
    .filter((r) => r.status === "active")
    .flatMap((r) =>
      r.beds.filter((b) => !b.occupant && b.status === "active").map((b) => ({ id: b.id, roomCode: r.code, label: b.label, rate: b.rate })),
    );
}

type MemberRow = {
  id: string;
  profiles: { full_name: string; email: string } | null;
  boarder_assignments: { move_out_date: string | null }[];
};

/** Current (not archived) boarders who have no bed yet. */
export async function listUnassignedBoarders(): Promise<BoarderOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, profiles(full_name, email), boarder_assignments(move_out_date)")
    .eq("role", "boarder")
    .neq("status", "archived")
    .returns<MemberRow[]>();
  if (error) throw new Error("Could not load boarders");
  return data
    .filter((m) => !m.boarder_assignments.some((a) => a.move_out_date === null))
    .map((m) => ({ id: m.id, name: m.profiles?.full_name || m.profiles?.email || "Boarder" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
