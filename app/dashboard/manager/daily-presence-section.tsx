"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n/provider";
import {
  buildDailyPresenceMatrix,
  type DailyPresenceParticipant,
} from "@/lib/statistics/daily-presence";

type DailyPresenceSectionProps = {
  participants: DailyPresenceParticipant[];
  hostelNames: string[];
};

function formatDayLabel(day: string): string {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
}

export function DailyPresenceSection({
  participants,
  hostelNames,
}: DailyPresenceSectionProps) {
  const { t } = useI18n();
  const matrix = useMemo(
    () => buildDailyPresenceMatrix(participants, hostelNames),
    [hostelNames, participants],
  );

  return (
    <section id="daily-presence" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{t("manager.presence.title")}</h3>

      <div className="mt-4 overflow-auto">
        <table className="min-w-[760px] divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="sticky left-0 z-10 min-w-52 bg-slate-50 px-4 py-3 text-left font-semibold">
                {t("manager.presence.sleepingPlace")}
              </th>
              {matrix.days.map((day) => (
                <th key={day} className="whitespace-nowrap px-4 py-3 text-center font-semibold">
                  {formatDayLabel(day)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {matrix.days.length === 0 ? (
              <tr>
                <td colSpan={1} className="px-4 py-4 text-slate-500">
                  {t("manager.presence.empty")}
                </td>
              </tr>
            ) : (
              matrix.rows.map((row) => (
                <tr
                  key={row.key}
                  className={row.kind === "total" ? "bg-indigo-50 font-bold" : undefined}
                >
                  <th
                    scope="row"
                    className={`sticky left-0 z-10 px-4 py-3 text-left ${
                      row.kind === "total" ? "bg-indigo-50 text-indigo-950" : "bg-white text-slate-900"
                    }`}
                  >
                    {row.kind === "external"
                      ? t("manager.presence.externalOrHotel")
                      : row.kind === "unassigned"
                        ? t("manager.presence.hostelUnassigned")
                        : row.kind === "total"
                          ? t("manager.registrations.total")
                          : row.label}
                  </th>
                  {row.counts.map((count, index) => (
                    <td
                      key={matrix.days[index]}
                      className={`px-4 py-3 text-center tabular-nums ${
                        row.kind === "total" ? "text-indigo-950" : "font-medium text-slate-900"
                      }`}
                    >
                      {count}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
