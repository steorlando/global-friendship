export type FoodNeedsRoomAssignmentRow = {
  partecipante_id: string | null;
  stanza_id: string | null;
};

export type FoodNeedsRoomRow = {
  id: string;
  albergo_id: string | null;
};

export type FoodNeedsHotelRow = {
  id: string;
  nome: string | null;
};

export function buildAssignedHostelNameByParticipant(
  assignments: readonly FoodNeedsRoomAssignmentRow[],
  rooms: readonly FoodNeedsRoomRow[],
  hotels: readonly FoodNeedsHotelRow[],
): Map<string, string> {
  const hotelNameById = new Map(
    hotels.flatMap((hotel) => {
      const name = hotel.nome?.trim();
      return name ? [[hotel.id, name] as const] : [];
    }),
  );
  const hostelNameByRoomId = new Map(
    rooms.flatMap((room) => {
      if (!room.albergo_id) return [];
      const hostelName = hotelNameById.get(room.albergo_id);
      return hostelName ? [[room.id, hostelName] as const] : [];
    }),
  );
  const hostelNameByParticipantId = new Map<string, string>();

  for (const assignment of assignments) {
    if (!assignment.partecipante_id || !assignment.stanza_id) continue;
    const hostelName = hostelNameByRoomId.get(assignment.stanza_id);
    if (!hostelName) continue;

    const currentHostelName = hostelNameByParticipantId.get(
      assignment.partecipante_id,
    );
    if (currentHostelName && currentHostelName !== hostelName) {
      throw new Error(
        `Participant ${assignment.partecipante_id} has assignments in multiple hostels`,
      );
    }
    hostelNameByParticipantId.set(assignment.partecipante_id, hostelName);
  }

  return hostelNameByParticipantId;
}
