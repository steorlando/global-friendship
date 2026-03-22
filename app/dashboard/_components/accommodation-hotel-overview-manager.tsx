"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

type Hotel = {
  id: string;
  name: string;
  address: string | null;
  googleMapsUrl: string | null;
  createdAt: string;
  roomCount: number;
};

type OverviewRow = {
  groupId: string;
  groupName: string;
  needsAccommodationCount: number;
  unassignedCount: number;
  hotelCounts: Record<string, number>;
  assignedBedCount: number;
  unassignedBedCount: number;
  hotelBedCounts: Record<string, number>;
  isRomeGroup: boolean;
};

type OverviewTotals = {
  needsAccommodationCount: number;
  unassignedCount: number;
  hotelCounts: Record<string, number>;
  assignedBedCount: number;
  unassignedBedCount: number;
  hotelBedCounts: Record<string, number>;
};

type OverviewResponse = {
  hotels?: Hotel[];
  rows?: OverviewRow[];
  totals?: OverviewTotals;
  error?: string;
};

type RomeGroupingMode = "standard" | "aggregate_rome";
type MetricMode = "participants" | "beds";

function matchesGroupSearch(row: OverviewRow, searchTerm: string): boolean {
  const normalized = searchTerm.trim().toLowerCase();
  if (!normalized) return true;

  return `${row.groupName} ${row.groupId}`.toLowerCase().includes(normalized);
}

function sortOverviewRows(rows: OverviewRow[], metricMode: MetricMode): OverviewRow[] {
  return [...rows].sort((a, b) => {
    const byUnassigned =
      metricMode === "beds"
        ? b.unassignedBedCount - a.unassignedBedCount
        : b.unassignedCount - a.unassignedCount;
    if (byUnassigned !== 0) return byUnassigned;

    const byNeed = b.needsAccommodationCount - a.needsAccommodationCount;
    if (byNeed !== 0) return byNeed;

    return a.groupName.localeCompare(b.groupName);
  });
}

function aggregateRomeRows(
  rows: OverviewRow[],
  hotels: Hotel[],
  romeLabel: string,
  metricMode: MetricMode
): OverviewRow[] {
  const romeRows = rows.filter((row) => row.isRomeGroup);
  const otherRows = rows.filter((row) => !row.isRomeGroup);

  if (romeRows.length <= 1) {
    return sortOverviewRows(rows, metricMode);
  }

  const aggregatedRomeRow: OverviewRow = {
    groupId: "__rome__",
    groupName: romeLabel,
    needsAccommodationCount: romeRows.reduce(
      (sum, row) => sum + row.needsAccommodationCount,
      0
    ),
    unassignedCount: romeRows.reduce((sum, row) => sum + row.unassignedCount, 0),
    hotelCounts: Object.fromEntries(hotels.map((hotel) => [hotel.id, 0])),
    assignedBedCount: romeRows.reduce((sum, row) => sum + row.assignedBedCount, 0),
    unassignedBedCount: romeRows.reduce((sum, row) => sum + row.unassignedBedCount, 0),
    hotelBedCounts: Object.fromEntries(hotels.map((hotel) => [hotel.id, 0])),
    isRomeGroup: true,
  };

  for (const row of romeRows) {
    for (const hotel of hotels) {
      aggregatedRomeRow.hotelCounts[hotel.id] += row.hotelCounts[hotel.id] ?? 0;
      aggregatedRomeRow.hotelBedCounts[hotel.id] += row.hotelBedCounts[hotel.id] ?? 0;
    }
  }

  return sortOverviewRows([...otherRows, aggregatedRomeRow], metricMode);
}

function buildFilteredTotals(rows: OverviewRow[], hotels: Hotel[]): OverviewTotals {
  const totals: OverviewTotals = {
    needsAccommodationCount: 0,
    unassignedCount: 0,
    hotelCounts: Object.fromEntries(hotels.map((hotel) => [hotel.id, 0])),
    assignedBedCount: 0,
    unassignedBedCount: 0,
    hotelBedCounts: Object.fromEntries(hotels.map((hotel) => [hotel.id, 0])),
  };

  for (const row of rows) {
    totals.needsAccommodationCount += row.needsAccommodationCount;
    totals.unassignedCount += row.unassignedCount;
    totals.assignedBedCount += row.assignedBedCount;
    totals.unassignedBedCount += row.unassignedBedCount;

    for (const hotel of hotels) {
      totals.hotelCounts[hotel.id] += row.hotelCounts[hotel.id] ?? 0;
      totals.hotelBedCounts[hotel.id] += row.hotelBedCounts[hotel.id] ?? 0;
    }
  }

  return totals;
}

export function AccommodationHotelOverviewManager() {
  const { t, formatNumber } = useI18n();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [totals, setTotals] = useState<OverviewTotals>({
    needsAccommodationCount: 0,
    unassignedCount: 0,
    hotelCounts: {},
    assignedBedCount: 0,
    unassignedBedCount: 0,
    hotelBedCounts: {},
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [romeGroupingMode, setRomeGroupingMode] =
    useState<RomeGroupingMode>("standard");
  const [metricMode, setMetricMode] = useState<MetricMode>("participants");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/alloggi/hotel-overview", {
        cache: "no-store",
      });
      const json = (await response.json()) as OverviewResponse;

      if (!response.ok) {
        throw new Error(json.error || t("accommodation.hotelOverview.status.loadError"));
      }

      const nextHotels = json.hotels ?? [];
      const nextRows = sortOverviewRows(json.rows ?? [], "participants");
      setHotels(nextHotels);
      setRows(nextRows);
      setTotals(
        json.totals ?? {
          needsAccommodationCount: 0,
          unassignedCount: 0,
          hotelCounts: Object.fromEntries(nextHotels.map((hotel) => [hotel.id, 0])),
          assignedBedCount: 0,
          unassignedBedCount: 0,
          hotelBedCounts: Object.fromEntries(nextHotels.map((hotel) => [hotel.id, 0])),
        }
      );
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const rowsForSelectedMode = useMemo(() => {
    if (romeGroupingMode === "aggregate_rome") {
      return aggregateRomeRows(
        rows,
        hotels,
        t("accommodation.hotelOverview.grouping.romeLabel"),
        metricMode
      );
    }
    return sortOverviewRows(rows, metricMode);
  }, [hotels, metricMode, romeGroupingMode, rows, t]);

  const displayedRows = useMemo(() => {
    return rowsForSelectedMode.filter((row) =>
      matchesGroupSearch(row, deferredSearchTerm)
    );
  }, [deferredSearchTerm, rowsForSelectedMode]);

  const filteredTotals = useMemo(
    () => buildFilteredTotals(displayedRows, hotels),
    [displayedRows, hotels]
  );

  const assignedCount = Math.max(
    0,
    totals.needsAccommodationCount - totals.unassignedCount
  );
  const summaryAssignedValue =
    metricMode === "beds" ? totals.assignedBedCount : assignedCount;
  const summaryUnassignedValue =
    metricMode === "beds" ? totals.unassignedBedCount : totals.unassignedCount;
  const tableUnassignedLabel =
    metricMode === "beds"
      ? t("accommodation.hotelOverview.table.uncoveredBeds")
      : t("accommodation.hotelOverview.table.unassigned");
  const displayedTotalCount = rowsForSelectedMode.length;
  const isRomeGrouped = romeGroupingMode === "aggregate_rome";

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {t("accommodation.hotelOverview.summary.groups")}
          </p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">
            {formatNumber(rows.length)}
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {t("accommodation.hotelOverview.summary.need")}
          </p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">
            {formatNumber(totals.needsAccommodationCount)}
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {metricMode === "beds"
              ? t("accommodation.hotelOverview.summary.assignedBeds")
              : t("accommodation.hotelOverview.summary.assigned")}
          </p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">
            {formatNumber(summaryAssignedValue)}
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {metricMode === "beds"
              ? t("accommodation.hotelOverview.summary.uncoveredBeds")
              : t("accommodation.hotelOverview.summary.unassigned")}
          </p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">
            {formatNumber(summaryUnassignedValue)}
          </p>
        </article>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {t("accommodation.hotelOverview.table.title")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              {t("accommodation.hotelOverview.table.subtitle")}
            </p>
          </div>

          <div className="w-full max-w-md">
            <label
              htmlFor="hotel-overview-group-search"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              {t("accommodation.hotelOverview.filters.search")}
            </label>
            <input
              id="hotel-overview-group-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("accommodation.hotelOverview.filters.searchPlaceholder")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="w-full max-w-xs">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              {t("accommodation.hotelOverview.filters.grouping")}
            </span>
            <label className="flex items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
              <button
                type="button"
                role="switch"
                aria-checked={isRomeGrouped}
                aria-label={t("accommodation.hotelOverview.filters.groupRome")}
                onClick={() =>
                  setRomeGroupingMode((current) =>
                    current === "aggregate_rome" ? "standard" : "aggregate_rome"
                  )
                }
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${
                  isRomeGrouped ? "bg-indigo-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                    isRomeGrouped ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
              <span>{t("accommodation.hotelOverview.filters.groupRome")}</span>
            </label>
          </div>

          <div className="w-full max-w-xs">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              {t("accommodation.hotelOverview.filters.metric")}
            </span>
            <div className="inline-flex w-full rounded-lg border border-slate-300 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMetricMode("participants")}
                aria-pressed={metricMode === "participants"}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                  metricMode === "participants"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t("accommodation.hotelOverview.metric.participants")}
              </button>
              <button
                type="button"
                onClick={() => setMetricMode("beds")}
                aria-pressed={metricMode === "beds"}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                  metricMode === "beds"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t("accommodation.hotelOverview.metric.beds")}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <p>
            {t("accommodation.hotelOverview.table.filteredCount", {
              shown: formatNumber(displayedRows.length),
              total: formatNumber(displayedTotalCount),
            })}
          </p>
          {!hotels.length ? (
            <p>{t("accommodation.hotelOverview.table.noHotels")}</p>
          ) : null}
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700">
                  {t("accommodation.hotelOverview.table.group")}
                </th>
                <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-center font-semibold text-slate-700">
                  {tableUnassignedLabel}
                </th>
                {hotels.map((hotel) => (
                  <th
                    key={hotel.id}
                    className="min-w-[120px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-center font-semibold text-slate-700"
                  >
                    {hotel.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={Math.max(2, hotels.length + 2)}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    {t("accommodation.hotelOverview.table.loading")}
                  </td>
                </tr>
              ) : displayedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(2, hotels.length + 2)}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    {t("accommodation.hotelOverview.table.empty")}
                  </td>
                </tr>
              ) : (
                displayedRows.map((row) => (
                  <tr key={row.groupId} className="odd:bg-white even:bg-slate-50/60">
                    <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-4 py-3 font-medium text-slate-900 even:bg-slate-50/60">
                      <div>{row.groupName}</div>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3 text-center font-semibold text-amber-700">
                      {formatNumber(
                        metricMode === "beds"
                          ? row.unassignedBedCount
                          : row.unassignedCount
                      )}
                    </td>
                    {hotels.map((hotel) => (
                      <td
                        key={`${row.groupId}-${hotel.id}`}
                        className="border-b border-slate-100 px-4 py-3 text-center text-slate-700"
                      >
                        {formatNumber(
                          metricMode === "beds"
                            ? row.hotelBedCounts[hotel.id] ?? 0
                            : row.hotelCounts[hotel.id] ?? 0
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {!loading && displayedRows.length > 0 ? (
              <tfoot>
                <tr>
                  <th className="sticky left-0 z-10 border-t border-slate-300 bg-slate-100 px-4 py-3 text-left font-semibold text-slate-900">
                    {t("accommodation.hotelOverview.table.total")}
                  </th>
                  <th className="border-t border-slate-300 bg-slate-100 px-4 py-3 text-center font-semibold text-slate-900">
                    {formatNumber(
                      metricMode === "beds"
                        ? filteredTotals.unassignedBedCount
                        : filteredTotals.unassignedCount
                    )}
                  </th>
                  {hotels.map((hotel) => (
                    <th
                      key={`total-${hotel.id}`}
                      className="border-t border-slate-300 bg-slate-100 px-4 py-3 text-center font-semibold text-slate-900"
                    >
                      {formatNumber(
                        metricMode === "beds"
                          ? filteredTotals.hotelBedCounts[hotel.id] ?? 0
                          : filteredTotals.hotelCounts[hotel.id] ?? 0
                      )}
                    </th>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>
    </div>
  );
}
