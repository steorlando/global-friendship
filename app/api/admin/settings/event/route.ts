import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  DEFAULT_EVENT_END_DATE,
  DEFAULT_EVENT_HOST_CITY,
  DEFAULT_EVENT_START_DATE,
  isMissingAdminEventSettingsTable,
  loadAdminEventSettings,
  loadEventRuntimeSettings,
} from "@/lib/event/settings";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function isValidDateOnly(value: string): boolean {
  return DATE_REGEX.test(value);
}

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

export async function GET() {
  const auth = await requireAdminUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const service = createSupabaseServiceClient();
    const settings = await loadEventRuntimeSettings(service);

    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdminUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const eventStartDate = normalizeText(body.eventStartDate) || DEFAULT_EVENT_START_DATE;
  const eventEndDate = normalizeText(body.eventEndDate) || DEFAULT_EVENT_END_DATE;
  const hostCity = normalizeText(body.hostCity) || DEFAULT_EVENT_HOST_CITY;
  const hostelCheckInEnabled = body.hostelCheckInEnabled === true;

  if (!isValidDateOnly(eventStartDate)) {
    return NextResponse.json({ error: "Valid eventStartDate is required" }, { status: 400 });
  }
  if (!isValidDateOnly(eventEndDate)) {
    return NextResponse.json({ error: "Valid eventEndDate is required" }, { status: 400 });
  }
  if (!hostCity) {
    return NextResponse.json({ error: "Valid hostCity is required" }, { status: 400 });
  }
  if (toDateOnly(eventEndDate).getTime() < toDateOnly(eventStartDate).getTime()) {
    return NextResponse.json(
      { error: "eventEndDate must be on or after eventStartDate" },
      { status: 400 }
    );
  }

  try {
    const service = createSupabaseServiceClient();
    await loadAdminEventSettings(service);

    const { data, error } = await service
      .from("admin_event_settings")
      .upsert(
        {
          id: true,
          event_start_date: eventStartDate,
          event_end_date: eventEndDate,
          host_city: hostCity,
          hostel_check_in_enabled: hostelCheckInEnabled,
        },
        { onConflict: "id" }
      )
      .select(
        "event_start_date,event_end_date,host_city,hostel_check_in_enabled,updated_at"
      )
      .single();

    if (error) {
      if (isMissingAdminEventSettingsTable(error)) {
        return NextResponse.json(
          { error: "Missing table admin_event_settings. Run the Supabase migration first." },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      eventStartDate: data.event_start_date,
      eventEndDate: data.event_end_date,
      hostCity: data.host_city,
      hostelCheckInEnabled: data.hostel_check_in_enabled === true,
      updatedAt: data.updated_at,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export const PUT = PATCH;
