import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { GLOBAL_FRIENDSHIP_EVENT_DATE } from "@/lib/tally/calculated-fields";

type MaybeSupabaseError = {
  code?: string;
  message?: string;
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDate(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

export const DEFAULT_EVENT_START_DATE = GLOBAL_FRIENDSHIP_EVENT_DATE;
export const DEFAULT_EVENT_END_DATE = "2026-08-30";
export const DEFAULT_EVENT_HOST_CITY = "Budapest";

type AdminEventSettingsRow = {
  id: boolean;
  event_start_date: string;
  event_end_date: string;
  host_city: string;
  hostel_check_in_enabled?: boolean | null;
  created_at: string;
  updated_at: string;
};

export type EventRuntimeSettings = {
  eventStartDate: string;
  eventEndDate: string;
  hostCity: string;
  hostelCheckInEnabled: boolean;
  updatedAt: string | null;
};

function isMissingAdminEventSettingsTable(error: MaybeSupabaseError | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (error.message ?? "").includes("Could not find the table 'public.admin_event_settings'")
  );
}

export async function loadAdminEventSettings(
  service: SupabaseClient = createSupabaseServiceClient()
) {
  const { data, error } = await service
    .from("admin_event_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    if (isMissingAdminEventSettingsTable(error)) {
      return null;
    }
    throw new Error(error.message);
  }

  return (data as AdminEventSettingsRow | null) ?? null;
}

export { isMissingAdminEventSettingsTable };

export async function loadEventRuntimeSettings(
  service: SupabaseClient = createSupabaseServiceClient()
): Promise<EventRuntimeSettings> {
  const row = await loadAdminEventSettings(service);

  return {
    eventStartDate: normalizeDate(row?.event_start_date) ?? DEFAULT_EVENT_START_DATE,
    eventEndDate: normalizeDate(row?.event_end_date) ?? DEFAULT_EVENT_END_DATE,
    hostCity: normalizeText(row?.host_city) ?? DEFAULT_EVENT_HOST_CITY,
    hostelCheckInEnabled: row?.hostel_check_in_enabled === true,
    updatedAt: row?.updated_at ?? null,
  };
}
