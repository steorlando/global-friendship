"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type {
  AccommodationOperationalSummary,
  AccommodationRoomRosterSection,
} from "@/lib/alloggi/operations";
import {
  buildAccommodationRoomRosterColumns,
  buildAccommodationRoomRosterCsv,
  buildAccommodationRoomRosterRows,
  exportRowsToPdf,
  exportRowsToXlsx,
  matchesOperationalRosterParticipantSearch,
} from "@/lib/alloggi/operations-presentation";

type OperationalRosterResponse = {
  summary?: AccommodationOperationalSummary;
  rooms?: AccommodationRoomRosterSection[];
  error?: string;
};

function formatAvailability(
  availableFrom: string | null,
  availableTo: string | null,
  formatDate: (value: string) => string,
  fallback: string
): string {
  if (availableFrom && availableTo) {
    return `${formatDate(availableFrom)} - ${formatDate(availableTo)}`;
  }
  if (availableFrom) return `${formatDate(availableFrom)} - ${fallback}`;
  if (availableTo) return `${fallback} - ${formatDate(availableTo)}`;
  return fallback;
}

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

function matchesRoomSearch(room: AccommodationRoomRosterSection, searchTerm: string): boolean {
  const normalized = searchTerm.trim().toLowerCase();
  if (!normalized) return true;

  return [
    room.hotelName,
    room.internalCode,
    room.realRoomNumber,
    room.assignedGroups.join(" "),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function AccommodationRoomRosterManager() {
  const { t, formatNumber, formatDate } = useI18n();
  const [summary, setSummary] = useState<AccommodationOperationalSummary>({
    hotelCount: 0,
    roomCount: 0,
    sharedRoomCount: 0,
    assignedParticipantCount: 0,
    unassignedEligibleParticipantCount: 0,
  });
  const [rooms, setRooms] = useState<AccommodationRoomRosterSection[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState("all");
  const [selectedRoomId, setSelectedRoomId] = useState("all");
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
      setRooms(json.rooms ?? []);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const hotelOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const room of rooms) {
      seen.set(room.hotelId, room.hotelName);
    }
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rooms]);

  useEffect(() => {
    if (
      selectedHotelId !== "all" &&
      !hotelOptions.some((hotel) => hotel.id === selectedHotelId)
    ) {
      setSelectedHotelId("all");
    }
  }, [hotelOptions, selectedHotelId]);

  const roomOptions = useMemo(
    () =>
      rooms
        .filter((room) => selectedHotelId === "all" || room.hotelId === selectedHotelId)
        .map((room) => ({
          id: room.roomId,
          label: `${room.internalCode} · ${room.hotelName}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [rooms, selectedHotelId]
  );

  useEffect(() => {
    if (selectedRoomId !== "all" && !roomOptions.some((room) => room.id === selectedRoomId)) {
      setSelectedRoomId("all");
    }
  }, [roomOptions, selectedRoomId]);

  const displayedRooms = useMemo(() => {
    return rooms
      .filter((room) => selectedHotelId === "all" || room.hotelId === selectedHotelId)
      .filter((room) => selectedRoomId === "all" || room.roomId === selectedRoomId)
      .map((room) => {
        if (!deferredSearchTerm.trim()) return room;

        if (matchesRoomSearch(room, deferredSearchTerm)) {
          return room;
        }

        const matchingParticipants = room.participants.filter((participant) =>
          matchesOperationalRosterParticipantSearch(participant, deferredSearchTerm)
        );

        return {
          ...room,
          participants: matchingParticipants,
        };
      })
      .filter((room) => room.participants.length > 0);
  }, [deferredSearchTerm, rooms, selectedHotelId, selectedRoomId]);

  const displayedParticipantCount = useMemo(
    () => displayedRooms.reduce((sum, room) => sum + room.participants.length, 0),
    [displayedRooms]
  );

  const displayedHotelCount = useMemo(
    () => new Set(displayedRooms.map((room) => room.hotelId)).size,
    [displayedRooms]
  );

  const displayedSharedRoomCount = useMemo(
    () => displayedRooms.filter((room) => room.assignedGroups.length > 1).length,
    [displayedRooms]
  );

  const exportColumns = useMemo(
    () =>
      buildAccommodationRoomRosterColumns({
        hotel: t("accommodation.rosters.common.hotel"),
        room: t("accommodation.rosters.common.room"),
        realRoom: t("accommodation.rosters.common.realRoom"),
        capacity: t("accommodation.rosters.common.capacity"),
        groups: t("accommodation.rosters.common.groups"),
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
      buildAccommodationRoomRosterRows({
        rooms: displayedRooms,
        formatDate,
      }),
    [displayedRooms, formatDate]
  );

  const handleExport = useCallback(() => {
    const csv = buildAccommodationRoomRosterCsv({
      rooms: displayedRooms,
      headers: {
        hotel: t("accommodation.rosters.common.hotel"),
        room: t("accommodation.rosters.common.room"),
        realRoom: t("accommodation.rosters.common.realRoom"),
        capacity: t("accommodation.rosters.common.capacity"),
        groups: t("accommodation.rosters.common.groups"),
        participant: t("accommodation.rosters.common.participant"),
        sex: t("accommodation.rosters.common.sex"),
        arrival: t("accommodation.rosters.common.arrival"),
        departure: t("accommodation.rosters.common.departure"),
        email: t("accommodation.rosters.common.email"),
      },
      formatDate,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`accommodation-room-roster-${stamp}.csv`, csv);
  }, [displayedRooms, formatDate, t]);

  const handleExportXlsx = useCallback(async () => {
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await exportRowsToXlsx({
        fileName: `accommodation-room-roster-${stamp}.xlsx`,
        sheetName: "Room roster",
        columns: exportColumns,
        rows: exportRows,
      });
    } catch (exportError) {
      setError(
        (exportError as Error).message || t("accommodation.rosters.status.exportError")
      );
    }
  }, [exportColumns, exportRows, t]);

  const handleExportPdf = useCallback(async () => {
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await exportRowsToPdf({
        fileName: `accommodation-room-roster-${stamp}.pdf`,
        title: t("accommodation.roomRoster.title"),
        subtitle: t("accommodation.roomRoster.subtitle"),
        generatedAtLabel: t("accommodation.rosters.pdf.generatedAt"),
        generatedAtValue: new Date().toLocaleString(),
        note: t("accommodation.rosters.note.unassigned", {
          count: formatNumber(summary.unassignedEligibleParticipantCount),
        }),
        summary: [
          {
            label: t("accommodation.roomRoster.summary.hotels"),
            value: formatNumber(displayedHotelCount),
          },
          {
            label: t("accommodation.roomRoster.summary.rooms"),
            value: formatNumber(displayedRooms.length),
          },
          {
            label: t("accommodation.roomRoster.summary.participants"),
            value: formatNumber(displayedParticipantCount),
          },
          {
            label: t("accommodation.roomRoster.summary.sharedRooms"),
            value: formatNumber(displayedSharedRoomCount),
          },
        ],
        columns: exportColumns,
        rows: exportRows,
        emptyLabel: t("accommodation.roomRoster.empty"),
      });
    } catch (exportError) {
      setError(
        (exportError as Error).message || t("accommodation.rosters.status.exportError")
      );
    }
  }, [
    displayedHotelCount,
    displayedParticipantCount,
    displayedRooms.length,
    displayedSharedRoomCount,
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
            {t("accommodation.roomRoster.summary.hotels")}
          </p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">
            {formatNumber(displayedHotelCount)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("accommodation.roomRoster.summary.rooms")}
          </p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">
            {formatNumber(displayedRooms.length)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("accommodation.roomRoster.summary.participants")}
          </p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">
            {formatNumber(displayedParticipantCount)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("accommodation.roomRoster.summary.sharedRooms")}
          </p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">
            {formatNumber(displayedSharedRoomCount)}
          </p>
        </article>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:hidden">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_280px_auto] xl:items-end">
          <div>
            <label
              htmlFor="room-roster-search"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              {t("accommodation.rosters.filters.search")}
            </label>
            <input
              id="room-roster-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("accommodation.rosters.filters.searchPlaceholder")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label
              htmlFor="room-roster-hotel-filter"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              {t("accommodation.rosters.filters.hotel")}
            </label>
            <select
              id="room-roster-hotel-filter"
              value={selectedHotelId}
              onChange={(event) => setSelectedHotelId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">
                {t("accommodation.rosters.filters.allHotels")}
              </option>
              {hotelOptions.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="room-roster-room-filter"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              {t("accommodation.rosters.filters.room")}
            </label>
            <select
              id="room-roster-room-filter"
              value={selectedRoomId}
              onChange={(event) => setSelectedRoomId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">
                {t("accommodation.rosters.filters.allRooms")}
              </option>
              {roomOptions.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
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
            shown: formatNumber(displayedRooms.length),
            total: formatNumber(rooms.length),
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
      ) : displayedRooms.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm">
          {t("accommodation.roomRoster.empty")}
        </section>
      ) : (
        displayedRooms.map((room) => (
          <section
            key={room.roomId}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:break-inside-avoid"
          >
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {room.internalCode}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {room.hotelName}
                  </p>
                  {room.address ? (
                    <p className="mt-2 text-sm text-slate-500">{room.address}</p>
                  ) : null}
                  {room.googleMapsUrl ? (
                    <a
                      href={room.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      {t("accommodation.inventory.hotels.googleMapsLink")}
                    </a>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {t("accommodation.roomRoster.card.occupancy")}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {formatNumber(room.occupancyCount)} / {formatNumber(room.capacity)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {t("accommodation.rosters.common.realRoom")}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {room.realRoomNumber ?? "-"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {t("accommodation.roomRoster.card.policy")}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {t(`accommodation.inventory.policy.${room.genderPolicy}`)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {t("accommodation.roomRoster.card.availability")}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {formatAvailability(room.availableFrom, room.availableTo, formatDate, "-")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {room.assignedGroups.length > 0 ? (
                  room.assignedGroups.map((groupName) => (
                    <span
                      key={`${room.roomId}-${groupName}`}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {groupName}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {t("accommodation.roomRoster.card.noGroups")}
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
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
                  {room.participants.map((participant) => (
                    <tr
                      key={participant.assignmentId}
                      className="border-t border-slate-100 align-top"
                    >
                      <td className="px-4 py-3 text-slate-600">
                        {participant.groupName}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
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
