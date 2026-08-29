import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TourBookingExportRow = {
  firstName: string;
  lastName: string;
  phone: string;
  group: string;
  tourNumber: number;
  tourTitle: string;
};

type TourExportSourceRow = {
  id: string;
  title: string | null;
  created_at: string;
};

export async function loadTourBookingExportRows(
  service: SupabaseClient,
): Promise<TourBookingExportRow[]> {
  const [toursResult, bookingsResult] = await Promise.all([
    service
      .from("tours")
      .select("id,title,created_at")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    service
      .from("tour_bookings")
      .select("participant_id,tour_id,booked_at")
      .order("booked_at", { ascending: true }),
  ]);

  if (toursResult.error) throw new Error(toursResult.error.message);
  if (bookingsResult.error) throw new Error(bookingsResult.error.message);

  const tours = (toursResult.data ?? []) as TourExportSourceRow[];
  const tourById = new Map(
    tours.map((tour, index) => [
      String(tour.id),
      { tourNumber: index + 1, tourTitle: String(tour.title ?? "") },
    ]),
  );
  const participantIds = Array.from(
    new Set((bookingsResult.data ?? []).map((row) => String(row.participant_id))),
  );
  if (participantIds.length === 0) return [];

  const participantsResult = await service
    .from("partecipanti")
    .select("id,nome,cognome,telefono,gruppo_id,gruppo_label")
    .in("id", participantIds)
    .is("deleted_at", null);
  if (participantsResult.error) throw new Error(participantsResult.error.message);

  const participantById = new Map(
    (participantsResult.data ?? []).map((participant) => [
      String(participant.id),
      {
        firstName: String(participant.nome ?? ""),
        lastName: String(participant.cognome ?? ""),
        phone: String(participant.telefono ?? ""),
        group: String(participant.gruppo_label ?? participant.gruppo_id ?? ""),
      },
    ]),
  );

  return (bookingsResult.data ?? [])
    .flatMap((booking) => {
      const participant = participantById.get(String(booking.participant_id));
      const tour = tourById.get(String(booking.tour_id));
      return participant && tour ? [{ ...participant, ...tour }] : [];
    })
    .sort(
      (a, b) =>
        a.tourNumber - b.tourNumber ||
        a.lastName.localeCompare(b.lastName, "it", { sensitivity: "base" }) ||
        a.firstName.localeCompare(b.firstName, "it", { sensitivity: "base" }),
    );
}

export function buildTourBookingsWorkbook(rows: TourBookingExportRow[]): Buffer {
  const matrix = [
    ["Nome", "Cognome", "Telefono", "Gruppo", "Tour"],
    ...rows.map((row) => [
      row.firstName,
      row.lastName,
      row.phone,
      row.group,
      `Tour ${row.tourNumber} · ${row.tourTitle}`,
    ]),
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(matrix);
  worksheet["!autofilter"] = { ref: `A1:E${Math.max(1, matrix.length)}` };
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  worksheet["!cols"] = [
    { wch: 22 },
    { wch: 24 },
    { wch: 22 },
    { wch: 30 },
    { wch: 48 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Prenotazioni tour");
  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
  });
}
