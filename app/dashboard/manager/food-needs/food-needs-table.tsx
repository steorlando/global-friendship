"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import {
  FOOD_NEEDS_FILTERS,
  detectedFoodTextCategories,
  dietaryOtherDetails,
  hasMeaningfulAllergyText,
  matchesFoodNeedsFilter,
  parseDietarySelections,
  type FoodNeedsFilter,
} from "@/lib/statistics/food-needs";
import type { FoodNeedsExportRow } from "@/lib/statistics/food-needs-export";
import { displayPersonalCode } from "@/lib/statistics/staff-availability-export";

const FOOD_NEEDS_LABEL_KEYS: Record<FoodNeedsFilter, string> = {
  vegetarian: "manager.foodNeeds.vegetarian",
  vegan: "manager.foodNeeds.vegan",
  no_pork: "manager.foodNeeds.noPork",
  other: "manager.foodNeeds.other",
  allergies: "manager.foodNeeds.allergies",
  gluten_celiac: "manager.foodNeeds.glutenCeliac",
  lactose_dairy: "manager.foodNeeds.lactoseDairy",
  nuts_peanuts: "manager.foodNeeds.nutsPeanuts",
  fish_shellfish: "manager.foodNeeds.fishShellfish",
};

const DIETARY_OPTION_LABEL_KEYS: Record<string, string> = {
  Vegetarian: "participant.option.dietary.vegetarian",
  Vegan: "participant.option.dietary.vegan",
  "I don't eat pork": "participant.option.dietary.noPork",
  Other: "participant.option.dietary.other",
};

function DietaryNeeds({ row }: { row: FoodNeedsExportRow }) {
  const { t } = useI18n();
  const selections = parseDietarySelections(row.esigenze_alimentari);
  const otherDetails = dietaryOtherDetails(row.esigenze_alimentari);

  if (selections.length === 0 && !otherDetails) return <>—</>;

  return (
    <div className="space-y-2">
      {selections.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selections.map((selection) => (
            <span
              key={selection}
              className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200"
            >
              {t(DIETARY_OPTION_LABEL_KEYS[selection])}
            </span>
          ))}
        </div>
      ) : null}
      {otherDetails ? (
        <p className="text-xs leading-5 text-slate-600">
          <span className="font-semibold">{t("foodNeedsList.otherDetail")}:</span>{" "}
          {otherDetails}
        </p>
      ) : null}
    </div>
  );
}

function DetectedCategories({ row }: { row: FoodNeedsExportRow }) {
  const { t } = useI18n();
  const categories = detectedFoodTextCategories(row);
  if (categories.length === 0) return <>—</>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((category) => (
        <span
          key={category}
          className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-200"
        >
          {t(FOOD_NEEDS_LABEL_KEYS[category])}
        </span>
      ))}
    </div>
  );
}

export function FoodNeedsTable({
  rows,
  initialFilter,
}: {
  rows: FoodNeedsExportRow[];
  initialFilter: FoodNeedsFilter | null;
}) {
  const { t } = useI18n();
  const [activeFilter, setActiveFilter] = useState<FoodNeedsFilter | null>(
    initialFilter,
  );
  const filteredRows = useMemo(
    () =>
      activeFilter
        ? rows.filter((row) => matchesFoodNeedsFilter(row, activeFilter))
        : rows,
    [activeFilter, rows],
  );

  return (
    <>
      <div
        className="mt-5 flex flex-wrap items-center gap-2"
        aria-label={t("foodNeedsList.filters")}
      >
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t("foodNeedsList.filters")}
        </span>
        {FOOD_NEEDS_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() =>
              setActiveFilter((current) => (current === filter ? null : filter))
            }
            aria-pressed={activeFilter === filter}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
              activeFilter === filter
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
            }`}
          >
            {t(FOOD_NEEDS_LABEL_KEYS[filter])}
          </button>
        ))}
        {activeFilter ? (
          <button
            type="button"
            onClick={() => setActiveFilter(null)}
            className="ml-1 text-sm font-medium text-emerald-700 underline-offset-2 hover:underline"
          >
            {t("foodNeedsList.clearFilters")}
          </button>
        ) : null}
        <span className="ml-auto text-sm text-slate-500">
          {t("foodNeedsList.resultCount", { count: filteredRows.length })}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold">{t("foodNeedsList.id")}</th>
              <th className="px-4 py-3 font-semibold">{t("foodNeedsList.participant")}</th>
              <th className="px-4 py-3 font-semibold">{t("foodNeedsList.contacts")}</th>
              <th className="px-4 py-3 font-semibold">{t("foodNeedsList.group")}</th>
              <th className="px-4 py-3 font-semibold">{t("foodNeedsList.dietaryNeeds")}</th>
              <th className="px-4 py-3 font-semibold">{t("foodNeedsList.allergies")}</th>
              <th className="px-4 py-3 font-semibold">{t("foodNeedsList.detectedCategories")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  {t("foodNeedsList.empty")}
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-700">
                    {displayPersonalCode(row.personal_code) || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                    {[row.nome, row.cognome].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="min-w-56 px-4 py-3 text-slate-700">
                    <p>{row.email || "—"}</p>
                    {row.telefono ? <p className="mt-1 text-slate-500">{row.telefono}</p> : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {row.gruppo_label ?? row.gruppo_id ?? "—"}
                  </td>
                  <td className="min-w-72 px-4 py-3 text-slate-700">
                    <DietaryNeeds row={row} />
                  </td>
                  <td className="min-w-72 whitespace-pre-wrap px-4 py-3 text-slate-700">
                    {hasMeaningfulAllergyText(row.allergie) ? row.allergie?.trim() : "—"}
                  </td>
                  <td className="min-w-72 px-4 py-3 text-slate-700">
                    <DetectedCategories row={row} />
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
