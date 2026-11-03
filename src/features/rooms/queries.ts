import "server-only";
import { createClient } from "@/lib/supabase/server";

export type BedOccupant = { assignmentId: string; memberId: string; name: string; moveIn: string; rent: number };

export type BedView = {
  id: string;
  label: string;
  rate: number;
  status: "active" | "maintenance";
  occupant: BedOccupant | null;
};

export type RoomView = {
  id: string;
  propertyId: string;
  propertyName: string;
  code: string;
  floor: string | null;
  capacity: number;
  rate: number;
  status: "active" | "maintenance";
  notes: string | null;
  beds: BedView[];
};

type RoomRow = {
  id: string;
  property_id: string;
  code: string;
  floor: string | null;
  capacity: number;
  monthly_rate_centavos: number;
  status: "active" | "maintenance";
  notes: string | null;
  properties: { name: string } | null;
  beds: {
    id: string;
    label: string;
    monthly_rate_centavos: number;
    status: "active" | "maintenance";
    archived_at: string | null;
    boarder_assignments: {
      id: string;
      member_id: string;
      move_in_date: string;
      move_out_date: string | null;
      monthly_rent_centavos: number;
      organization_members: { profiles: { full_name: string; email: string } | null } | null;
    }[];
  }[];
};

const ROOM_SELECT = `id, property_id, code, floor, capacity, monthly_rate_centavos, status, notes,
  properties(name),
  beds(id, label, monthly_rate_centavos, status, archived_at,
    boarder_assignments(id, member_id, move_in_date, move_out_date, monthly_rent_centavos,
      organization_members(profiles(full_name, email))))`;

function toView(row: RoomRow): RoomView {
  return {
    id: row.id,
    propertyId: row.property_id,
    propertyName: row.properties?.name ?? "",
    code: row.code,
    floor: row.floor,
    capacity: row.capacity,
    rate: row.monthly_rate_centavos,
    status: row.status,
    notes: row.notes,
    beds: row.beds
      .filter((b) => !b.archived_at)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
      .map((b) => {
        const current = b.boarder_assignments.find((a) => a.move_out_date === null);
        const profile = current?.organization_members?.profiles;
        return {
          id: b.id,
          label: b.label,
          rate: b.monthly_rate_centavos,
          status: b.status,
          occupant: current
            ? {
                assignmentId: current.id,
                memberId: current.member_id,
                name: profile?.full_name || profile?.email || "Boarder",
                moveIn: current.move_in_date,
                rent: current.monthly_rent_centavos,
              }
            : null,
        };
      }),
  };
}

/** Active rooms with their beds and current occupants. RLS limits rows to the caller's organization. */
export async function listRooms(): Promise<RoomView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rooms")
    .select(ROOM_SELECT)
    .is("archived_at", null)
    .order("code")
    .returns<RoomRow[]>();
  if (error) throw new Error("Could not load rooms");
  return data
    .map(toView)
    .sort((a, b) => a.propertyName.localeCompare(b.propertyName) || a.code.localeCompare(b.code, undefined, { numeric: true }));
}

export async function getRoom(id: string): Promise<RoomView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rooms")
    .select(ROOM_SELECT)
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle<RoomRow>();
  if (error || !data) return null;
  return toView(data);
}

export type PropertyOption = { id: string; name: string };

export async function listProperties(): Promise<PropertyOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("properties")
    .select("id, name")
    .is("archived_at", null)
    .order("name")
    .returns<PropertyOption[]>();
  return data ?? [];
}

export function occupancy(rooms: RoomView[]) {
  const beds = rooms.flatMap((r) => r.beds.map((b) => ({ ...b, roomStatus: r.status })));
  const occupied = beds.filter((b) => b.occupant).length;
  const unavailable = beds.filter((b) => !b.occupant && (b.status === "maintenance" || b.roomStatus === "maintenance")).length;
  return {
    rooms: rooms.length,
    beds: beds.length,
    occupied,
    unavailable,
    available: beds.length - occupied - unavailable,
    rate: beds.length ? occupied / beds.length : 0,
  };
}
