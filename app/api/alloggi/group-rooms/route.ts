import { NextResponse } from "next/server";
import { requireAccommodationManagerContext } from "@/lib/alloggi/auth";
import {
  assignAccommodationRoomToGroup,
  loadAccommodationGroupRoomAllocations,
  loadAccommodationGroups,
  unassignAccommodationRoomFromGroup,
} from "@/lib/alloggi/group-allocations";
import { loadAccommodationRooms } from "@/lib/alloggi/inventory";

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET(req: Request) {
  const auth = await requireAccommodationManagerContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  const url = new URL(req.url);
  const groupId = normalizeText(url.searchParams.get("groupId"));

  try {
    const [groups, rooms, allocations] = await Promise.all([
      loadAccommodationGroups(auth.service),
      loadAccommodationRooms(auth.service),
      loadAccommodationGroupRoomAllocations(auth.service, { groupId }),
    ]);

    return NextResponse.json({
      groups,
      rooms,
      allocations,
      actorRole: auth.profile.ruolo,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireAccommodationManagerContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const allocation = await assignAccommodationRoomToGroup(auth.service, {
      groupId: normalizeText(body.groupId) ?? "",
      roomId: normalizeText(body.roomId) ?? "",
      actorId: auth.user.id,
    });

    return NextResponse.json(
      {
        ok: true,
        allocation,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = (error as Error).message;
    const status =
      message === "Room not found" || message === "Group not found"
        ? 404
        : message.includes("required")
          ? 400
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAccommodationManagerContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await unassignAccommodationRoomFromGroup(auth.service, {
      groupId: normalizeText(body.groupId) ?? "",
      roomId: normalizeText(body.roomId) ?? "",
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = (error as Error).message;
    const status = message.includes("required") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
