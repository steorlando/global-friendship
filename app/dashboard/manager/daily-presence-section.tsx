"use client";

import { useMemo, useState } from "react";

type AccommodationFilter = "both" | "organization" | "autonomous";

type DailyPresenceParticipant = {
  data_arrivo: string | null;
  data_partenza: string | null;
  alloggio_short: string | null;
  alloggio: string | null;
};

type DailyPresenceSectionProps = {
  participants: DailyPresenceParticipant[];
};

function normalizeAccommodation(raw: string | null): "organization" | "autonomous" | null {
  if (!raw) return null;
  const value = raw.toLowerCase().trim();

  if (
    value.includes("provided by organization") ||
    value.includes("struttura fornita dall'organizzazione") ||
    value.includes("struttura fornita dall’organizzazione")
  ) {
    return "organization";
  }

  if (
    value.includes("atonoumous") ||
    value.includes("autonomous") ||
    value.includes("alloggio autonomamente") ||
    value.includes("arranged my own accommodation")
  ) {
    return "autonomous";
  }

  return null;
}

function parseDateOnly(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function shouldIncludeByAccommodation(
  participant: DailyPresenceParticipant,
  filter: AccommodationFilter
): boolean {
  if (filter === "both") return true;
  const normalized = normalizeAccommodation(participant.alloggio_short ?? participant.alloggio);
  return normalized === filter;
}

export function DailyPresenceSection({ participants }: DailyPresenceSectionProps) {
  const [accommodationFilter, setAccommodationFilter] =
    useState<AccommodationFilter>("both");

  const dailyRows = useMemo(() => {
    const dailyPresence = new Map<string, number>();

    for (const participant of participants) {
      if (!shouldIncludeByAccommodation(participant, accommodationFilter)) continue;

      const arrival = parseDateOnly(participant.data_arrivo);
      const departure = parseDateOnly(participant.data_partenza);
      if (!arrival || !departure || departure < arrival) continue;

      for (let current = arrival; current <= departure; current = addDays(current, 1)) {
        const dayKey = formatDateOnly(current);
        dailyPresence.set(dayKey, (dailyPresence.get(dayKey) ?? 0) + 1);
      }
    }

    return [...dailyPresence.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({ day, count }));
  }, [accommodationFilter, participants]);

  return (
    <section id="daily-presence" className="rounded border border-neutral-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h3 className="text-lg font-semibold text-neutral-900">Daily presence</h3>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Accommodation filter
          <select
            value={accommodationFilter}
            onChange={(event) =>
              setAccommodationFilter(event.target.value as AccommodationFilter)
            }
            className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
          >
            <option value="both">Both</option>
            <option value="organization">Provided by organization</option>
            <option value="autonomous">Atonoumous</option>
          </select>
        </label>
      </div>

      <div className="mt-4 overflow-auto">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-700">
            <tr>
              <th className="px-3 py-2 font-semibold">Date</th>
              <th className="px-3 py-2 font-semibold">Present</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {dailyRows.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-3 py-3 text-neutral-500">
                  No presence data available for the selected filter.
                </td>
              </tr>
            ) : (
              dailyRows.map((row) => (
                <tr key={row.day}>
                  <td className="px-3 py-2 text-neutral-900">{row.day}</td>
                  <td className="px-3 py-2 font-medium text-neutral-900">{row.count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
