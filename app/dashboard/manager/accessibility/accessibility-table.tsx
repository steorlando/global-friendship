"use client";

import { useMemo, useState } from "react";
import {
  ACCESSIBILITY_FILTERS,
  matchesAccessibilityFilter,
  type AccessibilityFilter,
} from "@/lib/statistics/accessibility";
import type { AccessibilityExportRow } from "@/lib/statistics/accessibility-export";
import { displayPersonalCode } from "@/lib/statistics/staff-availability-export";
import { useI18n } from "@/lib/i18n/provider";

const ACCESSIBILITY_LABEL_KEYS: Record<AccessibilityFilter, string> = {
  seeing: "participant.option.accessibility.seeing",
  hearing: "participant.option.accessibility.hearing",
  walking: "participant.option.accessibility.walking",
  self_care: "participant.option.accessibility.selfCare",
  concentration: "participant.option.accessibility.concentration",
  communicating: "participant.option.accessibility.communicating",
  wheelchair: "participant.option.accessibility.wheelchair",
  accessible_accommodation: "participant.option.accessibility.accessibleAccommodation",
  assistance: "participant.option.accessibility.assistance",
};

function AccessibilityNeeds({
  row,
  t,
}: {
  row: AccessibilityExportRow;
  t: (key: string) => string;
}) {
  const filters = ACCESSIBILITY_FILTERS.filter((filter) =>
    matchesAccessibilityFilter(row, filter),
  );

  if (filters.length === 0) {
    return (
      <>{row.difficolta_accessibilita?.trim() || t("manager.accessibility.title")}</>
    );
  }

  return (
    <ul className="space-y-1">
      {filters.map((filter) => (
        <li key={filter}>{t(ACCESSIBILITY_LABEL_KEYS[filter])}</li>
      ))}
    </ul>
  );
}

export function AccessibilityTable({
  rows,
  initialFilter,
}: {
  rows: AccessibilityExportRow[];
  initialFilter: AccessibilityFilter | null;
}) {
  const { t } = useI18n();
  const [activeFilter, setActiveFilter] = useState<AccessibilityFilter | null>(
    initialFilter,
  );
  const filteredRows = useMemo(
    () =>
      activeFilter
        ? rows.filter((row) => matchesAccessibilityFilter(row, activeFilter))
        : rows,
    [activeFilter, rows],
  );

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-2" aria-label={t("accessibilityList.filters")}>
        <span className="mr-1 text-sm font-semibold text-slate-700">
          {t("accessibilityList.filters")}
        </span>
        {ACCESSIBILITY_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter((current) => current === filter ? null : filter)}
            aria-pressed={activeFilter === filter}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              activeFilter === filter
                ? "border-rose-600 bg-rose-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-rose-300 hover:bg-rose-50"
            }`}
          >
            {t(ACCESSIBILITY_LABEL_KEYS[filter])}
          </button>
        ))}
        {activeFilter ? (
          <button
            type="button"
            onClick={() => setActiveFilter(null)}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
          >
            {t("accessibilityList.clearFilters")}
          </button>
        ) : null}
        <span className="ml-auto text-sm text-slate-500">
          {t("accessibilityList.resultCount", { count: filteredRows.length })}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold">{t("accessibilityList.id")}</th>
              <th className="px-4 py-3 font-semibold">{t("accessibilityList.participant")}</th>
              <th className="px-4 py-3 font-semibold">{t("accessibilityList.contacts")}</th>
              <th className="px-4 py-3 font-semibold">{t("accessibilityList.group")}</th>
              <th className="px-4 py-3 font-semibold">{t("accessibilityList.needs")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  {t("accessibilityList.empty")}
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">
                    {displayPersonalCode(row.personal_code) || "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {[row.nome, row.cognome].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <div>{row.email || "—"}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.telefono || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {row.gruppo_label ?? row.gruppo_id ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <AccessibilityNeeds row={row} t={t} />
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
