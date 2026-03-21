import { NextResponse } from "next/server";
import { requireAccommodationManagerContext } from "@/lib/alloggi/auth";
import {
  createAccommodationHotel,
  deleteAccommodationHotel,
  loadAccommodationHotels,
  updateAccommodationHotel,
} from "@/lib/alloggi/inventory";

export async function GET() {
  const auth = await requireAccommodationManagerContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const hotels = await loadAccommodationHotels(auth.service);
    return NextResponse.json({
      hotels,
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
    const hotel = await createAccommodationHotel(auth.service, body);
    return NextResponse.json({ ok: true, hotel }, { status: 201 });
  } catch (error) {
    const message = (error as Error).message;
    const status = message.includes("required") ? 400 : 500;
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

  const hotelId = typeof body.id === "string" ? body.id.trim() : "";
  if (!hotelId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const hotel = await updateAccommodationHotel(auth.service, hotelId, body);
    return NextResponse.json({ ok: true, hotel });
  } catch (error) {
    const message = (error as Error).message;
    const status = message === "Hotel not found" ? 404 : message.includes("required") ? 400 : 500;
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

  const hotelId = typeof body.id === "string" ? body.id.trim() : "";
  if (!hotelId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const result = await deleteAccommodationHotel(auth.service, hotelId);
    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    const message = (error as Error).message;
    const status =
      message === "Hotel not found"
        ? 404
        : message.includes("Cannot delete a hotel")
          ? 400
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export const PUT = PATCH;
