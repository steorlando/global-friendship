import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { TourOverview, TourSettings } from "@/lib/tours/types";

type TourRow = {
  id: string;
  title: string;
  description: string;
  max_participants: number;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime_type: string | null;
  attachment_size_bytes: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const DEFAULT_SETTINGS: TourSettings = {
  publicEnabled: false,
  participantChangesEnabled: false,
};

export async function loadTourSettings(
  service: SupabaseClient = createSupabaseServiceClient({ noStore: true })
): Promise<TourSettings> {
  const { data, error } = await service
    .from("tour_settings")
    .select("public_enabled,participant_changes_enabled")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_SETTINGS;
  return {
    publicEnabled: Boolean(data.public_enabled),
    participantChangesEnabled: Boolean(data.participant_changes_enabled),
  };
}

export async function loadToursOverview(options: {
  includeInactive?: boolean;
  service?: SupabaseClient;
} = {}): Promise<TourOverview[]> {
  const service = options.service ?? createSupabaseServiceClient({ noStore: true });
  let toursQuery = service
    .from("tours")
    .select(
      "id,title,description,max_participants,contact_name,contact_phone,contact_email,attachment_path,attachment_name,attachment_mime_type,attachment_size_bytes,is_active,created_at,updated_at"
    )
    .order("created_at", { ascending: true });
  if (!options.includeInactive) toursQuery = toursQuery.eq("is_active", true);

  const now = new Date().toISOString();
  const [toursResult, bookingsResult, activeWaitlistResult] = await Promise.all([
    toursQuery,
    service.from("tour_bookings").select("tour_id"),
    service
      .from("tour_waitlist")
      .select("tour_id,status,offer_expires_at")
      .in("status", ["waiting", "offered"]),
  ]);

  if (toursResult.error) throw new Error(toursResult.error.message);
  if (bookingsResult.error) throw new Error(bookingsResult.error.message);
  if (activeWaitlistResult.error) throw new Error(activeWaitlistResult.error.message);

  const bookedByTour = new Map<string, number>();
  for (const booking of bookingsResult.data ?? []) {
    const tourId = String(booking.tour_id);
    bookedByTour.set(tourId, (bookedByTour.get(tourId) ?? 0) + 1);
  }

  const heldByTour = new Map<string, number>();
  const waitingByTour = new Map<string, number>();
  for (const row of activeWaitlistResult.data ?? []) {
    const tourId = String(row.tour_id);
    if (row.status === "waiting") {
      waitingByTour.set(tourId, (waitingByTour.get(tourId) ?? 0) + 1);
    } else if (row.status === "offered" && String(row.offer_expires_at ?? "") > now) {
      heldByTour.set(tourId, (heldByTour.get(tourId) ?? 0) + 1);
    }
  }

  return ((toursResult.data ?? []) as TourRow[]).map((tour) => {
    const bookedCount = bookedByTour.get(tour.id) ?? 0;
    const heldCount = heldByTour.get(tour.id) ?? 0;
    return {
      id: tour.id,
      title: tour.title,
      description: tour.description,
      maxParticipants: tour.max_participants,
      contactName: tour.contact_name,
      contactPhone: tour.contact_phone,
      contactEmail: tour.contact_email,
      attachmentName: tour.attachment_name,
      attachmentMimeType: tour.attachment_mime_type,
      attachmentSizeBytes: tour.attachment_size_bytes,
      attachmentUrl: tour.attachment_path
        ? `/api/tours/${encodeURIComponent(tour.id)}/attachment`
        : null,
      isActive: tour.is_active,
      bookedCount,
      heldCount,
      waitlistCount: (waitingByTour.get(tour.id) ?? 0) + heldCount,
      availableSpots: Math.max(0, tour.max_participants - bookedCount - heldCount),
      createdAt: tour.created_at,
      updatedAt: tour.updated_at,
    };
  });
}
