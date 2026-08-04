import "server-only";

import { hasFoodNeedsDeclaration } from "@/lib/statistics/food-needs";
import type { FoodNeedsExportRow } from "@/lib/statistics/food-needs-export";
import {
  buildAssignedHostelNameByParticipant,
  type FoodNeedsHotelRow,
  type FoodNeedsRoomAssignmentRow,
  type FoodNeedsRoomRow,
} from "@/lib/statistics/food-needs-hostels";
import { requireStaffAvailabilityManagerOrAdmin } from "@/lib/statistics/staff-availability-server";
import { batchInFilterValues } from "@/lib/supabase/query-batching";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export { requireStaffAvailabilityManagerOrAdmin as requireFoodNeedsManagerOrAdmin };

export async function loadFoodNeedsRows(
  service: ReturnType<typeof createSupabaseServiceClient>,
): Promise<FoodNeedsExportRow[]> {
  const { data, error } = await service
    .from("partecipanti")
    .select(
      "id,personal_code,email,telefono,nome,cognome,gruppo_label,gruppo_id,deleted_at,esigenze_alimentari,allergie",
    )
    .is("deleted_at", null)
    .order("gruppo_label", { ascending: true })
    .order("cognome", { ascending: true })
    .order("nome", { ascending: true });

  if (error) throw new Error(error.message);

  const foodNeedsRows = ((data ?? []) as Omit<
    FoodNeedsExportRow,
    "assigned_hostel_name"
  >[]).filter(hasFoodNeedsDeclaration);
  if (foodNeedsRows.length === 0) return [];

  const assignmentResponses = await Promise.all(
    batchInFilterValues(foodNeedsRows.map((row) => row.id)).map(
      (participantIdBatch) =>
        service
          .from("partecipanti_stanze")
          .select("partecipante_id,stanza_id")
          .in("partecipante_id", participantIdBatch),
    ),
  );
  const assignments: FoodNeedsRoomAssignmentRow[] = [];
  for (const response of assignmentResponses) {
    if (response.error) throw new Error(response.error.message);
    assignments.push(...((response.data ?? []) as FoodNeedsRoomAssignmentRow[]));
  }

  const roomIds = [
    ...new Set(
      assignments.flatMap((assignment) =>
        assignment.stanza_id ? [assignment.stanza_id] : [],
      ),
    ),
  ];
  const roomResponses = await Promise.all(
    batchInFilterValues(roomIds).map((roomIdBatch) =>
      service.from("stanze").select("id,albergo_id").in("id", roomIdBatch),
    ),
  );
  const rooms: FoodNeedsRoomRow[] = [];
  for (const response of roomResponses) {
    if (response.error) throw new Error(response.error.message);
    rooms.push(...((response.data ?? []) as FoodNeedsRoomRow[]));
  }

  const hotelIds = [
    ...new Set(
      rooms.flatMap((room) => (room.albergo_id ? [room.albergo_id] : [])),
    ),
  ];
  const hotelResponses = await Promise.all(
    batchInFilterValues(hotelIds).map((hotelIdBatch) =>
      service.from("alberghi").select("id,nome").in("id", hotelIdBatch),
    ),
  );
  const hotels: FoodNeedsHotelRow[] = [];
  for (const response of hotelResponses) {
    if (response.error) throw new Error(response.error.message);
    hotels.push(...((response.data ?? []) as FoodNeedsHotelRow[]));
  }

  const hostelNameByParticipantId = buildAssignedHostelNameByParticipant(
    assignments,
    rooms,
    hotels,
  );

  return foodNeedsRows.map((row) => ({
    ...row,
    assigned_hostel_name: hostelNameByParticipantId.get(row.id) ?? null,
  }));
}
