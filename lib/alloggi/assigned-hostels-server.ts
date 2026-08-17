import "server-only";

import type { createSupabaseServiceClient } from "@/lib/supabase/service";
import { batchInFilterValues } from "@/lib/supabase/query-batching";
import {
  buildAssignedHostelNameByParticipant,
  type FoodNeedsHotelRow,
  type FoodNeedsRoomAssignmentRow,
  type FoodNeedsRoomRow,
} from "@/lib/statistics/food-needs-hostels";

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

export async function loadAssignedHostelNameByParticipant(
  service: ServiceClient,
  participantIds: readonly string[],
): Promise<Map<string, string>> {
  const assignmentResponses = await Promise.all(
    batchInFilterValues([...new Set(participantIds)]).map((participantIdBatch) =>
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

  return buildAssignedHostelNameByParticipant(assignments, rooms, hotels);
}
