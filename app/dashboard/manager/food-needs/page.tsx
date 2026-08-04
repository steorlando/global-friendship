import Link from "next/link";
import { getServerTranslator } from "@/lib/i18n/server";
import {
  loadFoodNeedsRows,
  requireFoodNeedsManagerOrAdmin,
} from "@/lib/statistics/food-needs-server";
import { parseFoodNeedsFilter } from "@/lib/statistics/food-needs";
import type { FoodNeedsExportRow } from "@/lib/statistics/food-needs-export";
import { FoodNeedsTable } from "./food-needs-table";

export const dynamic = "force-dynamic";

export default async function FoodNeedsListPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
  const { t } = await getServerTranslator();
  const auth = await requireFoodNeedsManagerOrAdmin();

  if ("errorResponse" in auth) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">{t("foodNeedsList.title")}</h2>
        <p className="mt-2 text-sm text-red-700">{t("common.errorForbidden")}</p>
      </section>
    );
  }

  let rows: FoodNeedsExportRow[] = [];
  let loadError: string | null = null;
  try {
    rows = await loadFoodNeedsRows(auth.service);
  } catch (error) {
    loadError = error instanceof Error ? error.message : t("foodNeedsList.loadError");
  }

  const params = await searchParams;
  const rawFilter = Array.isArray(params.filter) ? params.filter[0] : params.filter;
  const initialFilter = parseFoodNeedsFilter(rawFilter);

  return (
    <section className="rounded-xl border border-emerald-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t("foodNeedsList.title")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("foodNeedsList.subtitle")}</p>
        </div>
        <Link
          href="/dashboard/manager#food-needs"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          <span aria-hidden="true">←</span>
          {t("foodNeedsList.back")}
        </Link>
      </div>

      {loadError ? (
        <p className="mt-5 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </p>
      ) : (
        <FoodNeedsTable rows={rows} initialFilter={initialFilter} />
      )}
    </section>
  );
}
