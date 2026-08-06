"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type {
  AccommodationHotelRosterSection,
  AccommodationOperationalSummary,
} from "@/lib/alloggi/operations";
import {
  buildAccommodationHotelRosterColumns,
  buildAccommodationHotelRosterCsv,
  buildAccommodationHotelRosterRows,
  buildAccommodationHotelRosterXlsxColumns,
  buildAccommodationHotelRosterXlsxRows,
  exportRowsToPdf,
  exportRowsToXlsx,
  matchesOperationalRosterParticipantSearch,
} from "@/lib/alloggi/operations-presentation";

type OperationalRosterResponse = {
  summary?: AccommodationOperationalSummary;
  hotels?: AccommodationHotelRosterSection[];
  error?: string;
};

function formatStayRange(
  arrivalDate: string | null,
  departureDate: string | null,
  formatDate: (value: string) => string,
  fallback: string
): string {
  if (arrivalDate && departureDate) {
    return `${formatDate(arrivalDate)} - ${formatDate(departureDate)}`;
  }
  if (arrivalDate) return `${formatDate(arrivalDate)} - ${fallback}`;
  if (departureDate) return `${fallback} - ${formatDate(departureDate)}`;
  return fallback;
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function AccommodationHotelRosterManager() {
  const { t, formatNumber, formatDate } = useI18n();
  const [summary, setSummary] = useState<AccommodationOperationalSummary>({
    hotelCount: 0,
    roomCount: 0,
    sharedRoomCount: 0,
    assignedParticipantCount: 0,
    unassignedEligibleParticipantCount: 0,
  });
  const [hotels, setHotels] = useState<AccommodationHotelRosterSection[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/alloggi/operational-rosters", {
        cache: "no-store",
      });
      const json = (await response.json()) as OperationalRosterResponse;

      if (!response.ok) {
        throw new Error(json.error || t("accommodation.rosters.status.loadError"));
      }

      setSummary(
        json.summary ?? {
          hotelCount: 0,
          roomCount: 0,
          sharedRoomCount: 0,
          assignedParticipantCount: 0,
          unassignedEligibleParticipantCount: 0,
        }
      );
      setHotels(json.hotels ?? []);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const displayedHotels = useMemo(() => {
    return hotels
      .filter((hotel) => selectedHotelId === "all" || hotel.hotelId === selectedHotelId)
      .map((hotel) => {
        if (!deferredSearchTerm.trim()) return hotel;

        const matchingParticipants = hotel.participants.filter((participant) =>
          matchesOperationalRosterParticipantSearch(participant, deferredSearchTerm)
        );

        return {
          ...hotel,
          participants: matchingParticipants,
        };
      })
      .filter((hotel) => hotel.participants.length > 0);
  }, [deferredSearchTerm, hotels, selectedHotelId]);

  const displayedRoomCount = useMemo(() => {
    const roomIds = new Set<string>();
    for (const hotel of displayedHotels) {
      for (const participant of hotel.participants) {
        roomIds.add(participant.roomId);
      }
    }
    return roomIds.size;
  }, [displayedHotels]);

  const displayedParticipantCount = useMemo(
    () => displayedHotels.reduce((sum, hotel) => sum + hotel.participants.length, 0),
    [displayedHotels]
  );

  const exportColumns = useMemo(
    () =>
      buildAccommodationHotelRosterColumns({
        hotel: t("accommodation.rosters.common.hotel"),
        room: t("accommodation.rosters.common.room"),
        realRoom: t("accommodation.rosters.common.realRoom"),
        group: t("accommodation.rosters.common.group"),
        participant: t("accommodation.rosters.common.participant"),
        sex: t("accommodation.rosters.common.sex"),
        arrival: t("accommodation.rosters.common.arrival"),
        departure: t("accommodation.rosters.common.departure"),
        email: t("accommodation.rosters.common.email"),
      }),
    [t]
  );

  const exportRows = useMemo(
    () =>
      buildAccommodationHotelRosterRows({
        hotels: displayedHotels,
        formatDate,
      }),
    [displayedHotels, formatDate]
  );

  const xlsxHotels = useMemo(() => {
    const hotelsForSelection = hotels.filter(
      (hotel) => selectedHotelId === "all" || hotel.hotelId === selectedHotelId
    );
    if (!deferredSearchTerm.trim()) return hotelsForSelection;

    return displayedHotels.map((hotel) => ({
      ...hotel,
      rooms: hotel.rooms.filter((room) =>
        hotel.participants.some((participant) => participant.roomId === room.roomId)
      ),
    }));
  }, [deferredSearchTerm, displayedHotels, hotels, selectedHotelId]);

  const xlsxColumns = useMemo(
    () =>
      buildAccommodationHotelRosterXlsxColumns({
        hotel: t("accommodation.rosters.common.hotel"),
        room: t("accommodation.rosters.common.room"),
        availableFrom: t("accommodation.rosters.common.availableFrom"),
        availableTo: t("accommodation.rosters.common.availableTo"),
        realRoom: t("accommodation.rosters.common.realRoom"),
        group: t("accommodation.rosters.common.group"),
        participant: t("accommodation.rosters.common.participant"),
        sex: t("accommodation.rosters.common.sex"),
        age: t("accommodation.rosters.common.age"),
        arrival: t("accommodation.rosters.common.arrival"),
        departure: t("accommodation.rosters.common.departure"),
        email: t("accommodation.rosters.common.email"),
      }),
    [t]
  );

  const xlsxRows = useMemo(
    () =>
      buildAccommodationHotelRosterXlsxRows({
        hotels: xlsxHotels,
        emptyBedLabel: t("accommodation.rosters.common.emptyBed"),
        formatDate,
      }),
    [formatDate, t, xlsxHotels]
  );

  const handleExport = useCallback(() => {
    const csv = buildAccommodationHotelRosterCsv({
      hotels: displayedHotels,
      headers: {
        hotel: t("accommodation.rosters.common.hotel"),
        room: t("accommodation.rosters.common.room"),
        realRoom: t("accommodation.rosters.common.realRoom"),
        group: t("accommodation.rosters.common.group"),
        participant: t("accommodation.rosters.common.participant"),
        sex: t("accommodation.rosters.common.sex"),
        arrival: t("accommodation.rosters.common.arrival"),
        departure: t("accommodation.rosters.common.departure"),
        email: t("accommodation.rosters.common.email"),
      },
      formatDate,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`accommodation-hotel-roster-${stamp}.csv`, csv);
  }, [displayedHotels, formatDate, t]);

  const handleExportXlsx = useCallback(async () => {
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await exportRowsToXlsx({
        fileName: `accommodation-hotel-roster-${stamp}.xlsx`,
        sheetName: "Hotel roster",
        columns: xlsxColumns,
        rows: xlsxRows,
      });
    } catch (exportError) {
      setError(
        (exportError as Error).message || t("accommodation.rosters.status.exportError")
      );
    }
  }, [t, xlsxColumns, xlsxRows]);

  const handleExportPdf = useCallback(async () => {
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await exportRowsToPdf({
        fileName: `accommodation-hotel-roster-${stamp}.pdf`,
        title: t("accommodation.hotelRoster.title"),
        subtitle: t("accommodation.hotelRoster.subtitle"),
        generatedAtLabel: t("accommodation.rosters.pdf.generatedAt"),
        generatedAtValue: new Date().toLocaleString(),
        note: t("accommodation.rosters.note.unassigned", {
          count: formatNumber(summary.unassignedEligibleParticipantCount),
        }),
        summary: [
          {
            label: t("accommodation.hotelRoster.summary.hotels"),
            value: formatNumber(displayedHotels.length),
          },
          {
            label: t("accommodation.hotelRoster.summary.rooms"),
            value: formatNumber(displayedRoomCount),
          },
          {
            label: t("accommodation.hotelRoster.summary.participants"),
            value: formatNumber(displayedParticipantCount),
          },
          {
            label: t("accommodation.hotelRoster.summary.unassigned"),
            value: formatNumber(summary.unassignedEligibleParticipantCount),
          },
        ],
        columns: exportColumns,
        rows: exportRows,
        emptyLabel: t("accommodation.hotelRoster.empty"),
      });
    } catch (exportError) {
      setError(
        (exportError as Error).message || t("accommodation.rosters.status.exportError")
      );
    }
  }, [
    displayedHotels.length,
    displayedParticipantCount,
    displayedRoomCount,
    exportColumns,
    exportRows,
    formatNumber,
    summary.unassignedEligibleParticipantCount,
    t,
  ]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("accommodation.hotelRoster.summary.hotels")}
          </p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">
            {formatNumber(displayedHotels.length)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("accommodation.hotelRoster.summary.rooms")}
          </p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">
            {formatNumber(displayedRoomCount)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("accommodation.hotelRoster.summary.participants")}
          </p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">
            {formatNumber(displayedParticipantCount)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("accommodation.hotelRoster.summary.unassigned")}
          </p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">
            {formatNumber(summary.unassignedEligibleParticipantCount)}
          </p>
        </article>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <label
                htmlFor="hotel-roster-search"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                {t("accommodation.rosters.filters.search")}
              </label>
              <input
                id="hotel-roster-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t("accommodation.rosters.filters.searchPlaceholder")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label
                htmlFor="hotel-roster-filter"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                {t("accommodation.rosters.filters.hotel")}
              </label>
              <select
                id="hotel-roster-filter"
                value={selectedHotelId}
                onChange={(event) => setSelectedHotelId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="all">
                  {t("accommodation.rosters.filters.allHotels")}
                </option>
                {hotels.map((hotel) => (
                  <option key={hotel.hotelId} value={hotel.hotelId}>
                    {hotel.hotelName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleExportPdf()}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              {t("accommodation.rosters.actions.exportPdf")}
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="rounded-lg border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              {t("accommodation.rosters.actions.exportCsv")}
            </button>
            <button
              type="button"
              onClick={() => void handleExportXlsx()}
              className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
            >
              {t("accommodation.rosters.actions.exportXlsx")}
            </button>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-500">
          {t("accommodation.rosters.filters.filteredCount", {
            shown: formatNumber(displayedHotels.length),
            total: formatNumber(hotels.length),
          })}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          {t("accommodation.rosters.note.unassigned", {
            count: formatNumber(summary.unassignedEligibleParticipantCount),
          })}
        </p>
      </section>

      {loading ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm">
          {t("accommodation.rosters.status.loading")}
        </section>
      ) : displayedHotels.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm">
          {t("accommodation.hotelRoster.empty")}
        </section>
      ) : (
        displayedHotels.map((hotel) => (
          <section
            key={hotel.hotelId}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:break-inside-avoid"
          >
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {hotel.hotelName}
                  </h2>
                  {hotel.address ? (
                    <p className="mt-2 text-sm text-slate-500">{hotel.address}</p>
                  ) : null}
                  {hotel.googleMapsUrl ? (
                    <a
                      href={hotel.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      {t("accommodation.inventory.hotels.googleMapsLink")}
                    </a>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {t("accommodation.hotelRoster.summary.rooms")}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {formatNumber(hotel.roomCount)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {t("accommodation.hotelRoster.summary.participants")}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {formatNumber(hotel.participantCount)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {t("accommodation.hotelRoster.summary.sharedRooms")}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {formatNumber(hotel.sharedRoomCount)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      {t("accommodation.rosters.common.room")}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      {t("accommodation.rosters.common.realRoom")}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      {t("accommodation.rosters.common.group")}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      {t("accommodation.rosters.common.participant")}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      {t("accommodation.rosters.common.sex")}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      {t("accommodation.rosters.common.stay")}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      {t("accommodation.rosters.common.email")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {hotel.participants.map((participant) => (
                    <tr
                      key={participant.assignmentId}
                      className="border-t border-slate-100 align-top"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {participant.roomInternalCode}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {participant.realRoomNumber ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {participant.groupName}
                      </td>
                      <td className="px-4 py-3 text-slate-900">
                        {participant.fullName}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {participant.sex ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatStayRange(
                          participant.arrivalDate,
                          participant.departureDate,
                          formatDate,
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {participant.email ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
