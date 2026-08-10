import "server-only";

import type { createSupabaseServiceClient } from "@/lib/supabase/service";
import { batchInFilterValues } from "@/lib/supabase/query-batching";
import {
  buildParticipantAssignmentExportDetails,
  type ParticipantHotelExportRow,
  type ParticipantListExportRow,
  type ParticipantRoomAssignmentExportRow,
  type ParticipantRoomExportRow,
} from "@/lib/participants/participants-export";

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

type ParticipantSourceRow = Omit<
  ParticipantListExportRow,
  "assigned_hostel_name" | "assigned_room_name" | "has_room_assignment"
>;

const PARTICIPANT_EXPORT_PAGE_SIZE = 1000;

export async function loadParticipantListExportRows(
  service: ServiceClient,
): Promise<ParticipantListExportRow[]> {
  const participants: ParticipantSourceRow[] = [];
  for (let start = 0; ; start += PARTICIPANT_EXPORT_PAGE_SIZE) {
    const { data, error } = await service
      .from("partecipanti")
      .select(
        "id,nome,cognome,gruppo_label,gruppo_id,tipo_iscrizione,eta,sesso,data_arrivo,data_partenza,alloggio,alloggio_short,preferenza_alloggio_operatore",
      )
      .is("deleted_at", null)
      .order("gruppo_label", { ascending: true })
      .order("cognome", { ascending: true })
      .order("nome", { ascending: true })
      .order("id", { ascending: true })
      .range(start, start + PARTICIPANT_EXPORT_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);

    const page = (data ?? []) as ParticipantSourceRow[];
    participants.push(...page);
    if (page.length < PARTICIPANT_EXPORT_PAGE_SIZE) break;
  }
  const assignmentResponses = await Promise.all(
    batchInFilterValues(participants.map((participant) => participant.id)).map(
      (participantIdBatch) =>
        service
          .from("partecipanti_stanze")
          .select("partecipante_id,stanza_id")
          .in("partecipante_id", participantIdBatch),
    ),
  );
  const assignments: ParticipantRoomAssignmentExportRow[] = [];
  for (const response of assignmentResponses) {
    if (response.error) throw new Error(response.error.message);
    assignments.push(...((response.data ?? []) as ParticipantRoomAssignmentExportRow[]));
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
      service
        .from("stanze")
        .select("id,albergo_id,numero_reale,nome,codice_interno")
        .in("id", roomIdBatch),
    ),
  );
  const rooms: ParticipantRoomExportRow[] = [];
  for (const response of roomResponses) {
    if (response.error) throw new Error(response.error.message);
    rooms.push(...((response.data ?? []) as ParticipantRoomExportRow[]));
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
  const hotels: ParticipantHotelExportRow[] = [];
  for (const response of hotelResponses) {
    if (response.error) throw new Error(response.error.message);
    hotels.push(...((response.data ?? []) as ParticipantHotelExportRow[]));
  }

  const assignmentDetails = buildParticipantAssignmentExportDetails(
    assignments,
    rooms,
    hotels,
  );

  return participants.map((participant) => {
    const assignment = assignmentDetails.get(participant.id);
    return {
      ...participant,
      assigned_hostel_name: assignment?.hostelName ?? null,
      assigned_room_name: assignment?.roomName ?? null,
      has_room_assignment: assignment?.hasRoomAssignment ?? false,
    };
  });
}
