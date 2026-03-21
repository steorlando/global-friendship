import { NextResponse } from "next/server";
import { requireAccommodationManagerContext } from "@/lib/alloggi/auth";
import {
  createAccommodationRoom,
  deleteAccommodationRoom,
  loadAccommodationRooms,
  updateAccommodationRoom,
} from "@/lib/alloggi/inventory";

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET(req: Request) {
  const auth = await requireAccommodationManagerContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  const url = new URL(req.url);
  const hotelId = normalizeText(url.searchParams.get("hotelId"));

  try {
    const rooms = await loadAccommodationRooms(auth.service, { hotelId });
    return NextResponse.json({
      rooms,
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
    const room = await createAccommodationRoom(auth.service, body);
    return NextResponse.json(
      {
        ok: true,
        room,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = (error as Error).message;
    const status =
      message.includes("required") ||
      message.includes("must be") ||
      message.includes("does not exist") ||
      message === "Hotel not found"
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAccommodationManagerContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const roomId = normalizeText(body.id);
  if (!roomId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const room = await updateAccommodationRoom(auth.service, roomId, body);
    return NextResponse.json({
      ok: true,
      room,
    });
  } catch (error) {
    const message = (error as Error).message;
    const status =
      message === "Room not found"
        ? 404
        : message.includes("required") ||
            message.includes("must be") ||
            message.includes("does not exist") ||
            message === "Hotel not found"
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

  const roomId = normalizeText(body.id);
  if (!roomId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const result = await deleteAccommodationRoom(auth.service, roomId);
    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    const message = (error as Error).message;
    const status =
      message === "Room not found"
        ? 404
        : message.includes("Cannot delete a room")
          ? 400
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export const PUT = PATCH;
