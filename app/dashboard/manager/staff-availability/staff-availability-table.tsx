"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import {
  matchesStaffAvailabilityAreas,
  type StaffAvailabilityAreaFilter,
} from "@/lib/statistics/staff-availability";
import type { SocialMediaTask } from "@/lib/partecipante/staff-availability";
import {
  displayPersonalCode,
  type StaffAvailabilityExportRow,
} from "@/lib/statistics/staff-availability-export";

const AREA_FILTERS: StaffAvailabilityAreaFilter[] = ["band", "choir", "social_media"];
const AREA_LABEL_KEYS: Record<StaffAvailabilityAreaFilter, string> = {
  band: "manager.staffAvailability.band",
  choir: "manager.staffAvailability.choir",
  social_media: "manager.staffAvailability.socialMedia",
};
const SOCIAL_TASK_LABEL_KEYS: Record<SocialMediaTask, string> = {
  capture: "participant.staff.social.capture",
  post_production: "participant.staff.social.post_production",
  short_posts: "participant.staff.social.short_posts",
  long_articles: "participant.staff.social.long_articles",
  other: "participant.staff.social.other",
};

function displayBand(row: StaffAvailabilityExportRow, t: (key: string) => string) {
  if (!row.availability.areas?.includes("band")) return "—";
  if (row.availability.band_role === "vocals") {
    return t("participant.staff.band.vocals");
  }
  if (row.availability.band_role === "instrument") {
    const instrument = (row.availability.band_instrument ?? "").trim();
    return instrument
      ? `${t("participant.staff.band.instrument")}: ${instrument}`
      : t("participant.staff.band.instrument");
  }
  return t("manager.staffAvailability.band");
}

function displaySocialMedia(
  row: StaffAvailabilityExportRow,
  t: (key: string) => string,
) {
  if (!row.availability.areas?.includes("social_media")) return "—";
  return (row.availability.social_media_tasks ?? [])
    .map((task) => {
      if (task !== "other") return t(SOCIAL_TASK_LABEL_KEYS[task]);
      const detail = (row.availability.social_media_other ?? "").trim();
      return detail ? `${t(SOCIAL_TASK_LABEL_KEYS.other)}: ${detail}` : t(SOCIAL_TASK_LABEL_KEYS.other);
    })
    .join(", ") || t("manager.staffAvailability.socialMedia");
}

export function StaffAvailabilityTable({ rows }: { rows: StaffAvailabilityExportRow[] }) {
  const { t, formatDate } = useI18n();
  const [activeFilters, setActiveFilters] = useState<StaffAvailabilityAreaFilter[]>([]);
  const filteredRows = useMemo(
    () => rows.filter((row) => matchesStaffAvailabilityAreas(row.availability, activeFilters)),
    [activeFilters, rows],
  );

  function toggleFilter(filter: StaffAvailabilityAreaFilter) {
    setActiveFilters((current) =>
      current.includes(filter)
        ? current.filter((item) => item !== filter)
        : [...current, filter],
    );
  }

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-2" aria-label={t("staffAvailabilityList.filters")}>
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t("staffAvailabilityList.filters")}
        </span>
        {AREA_FILTERS.map((filter) => {
          const active = activeFilters.includes(filter);
          return (
            <button
              key={filter}
              type="button"
              aria-pressed={active}
              onClick={() => toggleFilter(filter)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                active
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
              }`}
            >
              {t(AREA_LABEL_KEYS[filter])}
            </button>
          );
        })}
        {activeFilters.length > 0 ? (
          <button
            type="button"
            onClick={() => setActiveFilters([])}
            className="ml-1 text-sm font-medium text-indigo-700 underline-offset-2 hover:underline"
          >
            {t("staffAvailabilityList.clearFilters")}
          </button>
        ) : null}
        <span className="ml-auto text-sm text-slate-500">
          {t("staffAvailabilityList.resultCount", { count: filteredRows.length })}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold">{t("staffAvailabilityList.id")}</th>
              <th className="px-4 py-3 font-semibold">{t("staffAvailabilityList.participant")}</th>
              <th className="px-4 py-3 font-semibold">{t("staffAvailabilityList.contacts")}</th>
              <th className="px-4 py-3 font-semibold">{t("participants.table.header.group")}</th>
              <th className="px-4 py-3 font-semibold">{t("manager.staffAvailability.band")}</th>
              <th className="px-4 py-3 font-semibold">{t("manager.staffAvailability.choir")}</th>
              <th className="px-4 py-3 font-semibold">{t("manager.staffAvailability.socialMedia")}</th>
              <th className="px-4 py-3 font-semibold">{t("staffAvailabilityList.updatedAt")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  {t("staffAvailabilityList.empty")}
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-700">
                    {displayPersonalCode(row.personal_code) || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <p className="font-medium text-slate-900">{[row.nome, row.cognome].filter(Boolean).join(" ") || "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <p>{row.email || "—"}</p>
                    {row.telefono ? <p className="mt-1 text-slate-500">{row.telefono}</p> : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {row.gruppo_label ?? row.gruppo_id ?? "—"}
                  </td>
                  <td className="min-w-52 px-4 py-3 text-slate-700">{displayBand(row, t)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {row.availability.areas?.includes("choir") ? t("staffAvailabilityList.yes") : "—"}
                  </td>
                  <td className="min-w-72 px-4 py-3 text-slate-700">{displaySocialMedia(row, t)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {row.availability.updated_at
                      ? formatDate(row.availability.updated_at, { dateStyle: "short", timeStyle: "short" })
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
