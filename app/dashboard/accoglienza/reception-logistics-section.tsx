"use client";

import { useMemo, useState } from "react";
import {
  buildReceptionGroupHostelRows,
  buildReceptionHostelArrivalDayRows,
  type ArrivalParticipant,
} from "@/lib/accoglienza/arrivals";
import { useI18n } from "@/lib/i18n/provider";

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function ReceptionLogisticsSection({
  participants,
}: {
  participants: ArrivalParticipant[];
}) {
  const { t, formatDate } = useI18n();
  const [search, setSearch] = useState("");
  const groupRows = useMemo(
    () => buildReceptionGroupHostelRows(participants),
    [participants]
  );
  const arrivalRows = useMemo(
    () => buildReceptionHostelArrivalDayRows(participants),
    [participants]
  );
  const filteredGroupRows = useMemo(() => {
    const term = normalized(search);
    if (!term) return groupRows;
    return groupRows.filter((row) =>
      normalized([row.group, ...row.hostels.map((hostel) => hostel.name)].join(" ")).includes(
        term
      )
    );
  }, [groupRows, search]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
                {t("reception.logistics.eyebrow")}
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">
                {t("reception.logistics.title")}
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                {t("reception.logistics.subtitle")}
              </p>
            </div>
            <label className="block w-full lg:max-w-sm">
              <span className="sr-only">{t("reception.logistics.search")}</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("reception.logistics.search")}
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          </div>
        </div>

        <div className="p-3 sm:p-6">
          {filteredGroupRows.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              {t("reception.logistics.empty")}
            </p>
          ) : null}

          <div className="space-y-3 lg:hidden">
            {filteredGroupRows.map((row) => (
              <article
                key={row.group}
                className="rounded-xl border border-slate-200 bg-white p-4 [content-visibility:auto]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-950">{row.group}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {t("reception.logistics.hostelPeople", {
                        count: row.hostelParticipantCount,
                      })}
                    </p>
                  </div>
                  {row.unassignedCount > 0 ? (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                      {t("reception.logistics.toPlace", { count: row.unassignedCount })}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.hostels.map((hostel) => (
                    <span
                      key={hostel.name}
                      className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-950"
                    >
                      <span>{hostel.name}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-indigo-700">
                        {hostel.count}
                      </span>
                    </span>
                  ))}
                  {row.hostels.length === 0 ? (
                    <span className="text-sm text-slate-500">
                      {row.hostelParticipantCount === 0
                        ? t("reception.logistics.noHostelNeeded")
                        : t("reception.logistics.noHostelAssigned")}
                    </span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-slate-200 lg:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">{t("reception.table.group")}</th>
                  <th className="px-4 py-3">{t("reception.logistics.groupHostels")}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">
                    {t("reception.logistics.assigned")}
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">
                    {t("reception.logistics.unassigned")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredGroupRows.map((row) => (
                  <tr key={row.group} className="border-t border-slate-100 align-top hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <p className="font-bold text-slate-950">{row.group}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {t("reception.logistics.hostelPeople", {
                          count: row.hostelParticipantCount,
                        })}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {row.hostels.map((hostel) => (
                          <span
                            key={hostel.name}
                            className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 font-semibold text-indigo-950"
                          >
                            <span>{hostel.name}</span>
                            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-indigo-700">
                              {hostel.count}
                            </span>
                          </span>
                        ))}
                        {row.hostels.length === 0 ? (
                          <span className="text-slate-500">
                            {row.hostelParticipantCount === 0
                              ? t("reception.logistics.noHostelNeeded")
                              : t("reception.logistics.noHostelAssigned")}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right text-lg font-bold text-emerald-700">
                      {row.assignedCount > 0 ? row.assignedCount : "–"}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {row.unassignedCount > 0 ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-sm font-bold text-amber-800">
                          {row.unassignedCount}
                        </span>
                      ) : (
                        <span className="text-slate-300">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
            {t("reception.logistics.note")}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">
            {t("reception.arrivalPlan.eyebrow")}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">
            {t("reception.arrivalPlan.title")}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            {t("reception.arrivalPlan.subtitle")}
          </p>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-3 sm:px-4">{t("reception.table.arrivalDate")}</th>
                <th className="px-3 py-3 sm:px-4">{t("reception.arrivalPlan.byHostel")}</th>
                <th className="px-3 py-3 text-right sm:px-4">
                  {t("reception.summary.total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {arrivalRows.map((row) => (
                <tr
                  key={row.arrivalDate ?? "missing-date"}
                  className="border-t border-slate-100 align-top"
                >
                  <td className="whitespace-nowrap px-3 py-4 font-bold text-slate-950 sm:px-4">
                    {row.arrivalDate
                      ? formatDate(row.arrivalDate, {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                        })
                      : t("reception.arrivalPlan.missingDate")}
                  </td>
                  <td className="px-3 py-4 sm:px-4">
                    <div className="flex flex-wrap gap-2">
                      {row.hostels.map((hostel) => (
                        <span
                          key={hostel.name}
                          className="inline-flex items-center gap-2 rounded-lg bg-cyan-50 px-2.5 py-1.5 font-semibold text-cyan-950"
                        >
                          <span>{hostel.name}</span>
                          <span className="rounded-md bg-white px-1.5 py-0.5 text-xs font-bold text-cyan-700">
                            {hostel.count}
                          </span>
                        </span>
                      ))}
                      {row.unassignedCount > 0 ? (
                        <span className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 font-semibold text-amber-900">
                          <span>{t("reception.logistics.unassigned")}</span>
                          <span className="rounded-md bg-white px-1.5 py-0.5 text-xs font-bold text-amber-700">
                            {row.unassignedCount}
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-right text-xl font-bold text-slate-950 sm:px-4">
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
