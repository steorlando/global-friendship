import Link from "next/link";
import {
  loadAccessibilityRows,
  requireAccessibilityManagerOrAdmin,
} from "@/lib/statistics/accessibility-server";
import { parseAccessibilityFilter } from "@/lib/statistics/accessibility";
import { getServerTranslator } from "@/lib/i18n/server";
import { AccessibilityTable } from "./accessibility-table";
import type { AccessibilityExportRow } from "@/lib/statistics/accessibility-export";

export const dynamic = "force-dynamic";

export default async function AccessibilityListPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
  const { t } = await getServerTranslator();
  const auth = await requireAccessibilityManagerOrAdmin();
  if ("errorResponse" in auth) {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">{t("accessibilityList.title")}</h2>
        <p className="mt-2 text-sm text-red-700">{t("accessibilityList.loadError")}</p>
      </section>
    );
  }

  let rows: AccessibilityExportRow[] = [];
  let loadError: string | null = null;
  try {
    rows = await loadAccessibilityRows(auth.service);
  } catch (error) {
    loadError = error instanceof Error ? error.message : t("accessibilityList.loadError");
  }

  const params = await searchParams;
  const rawFilter = Array.isArray(params.filter) ? params.filter[0] : params.filter;
  const initialFilter = parseAccessibilityFilter(rawFilter);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t("accessibilityList.title")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("accessibilityList.subtitle")}</p>
        </div>
        <Link
          href="/dashboard/manager#accessibility"
          className="inline-flex w-fit items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          {t("accessibilityList.back")}
        </Link>
      </div>

      {loadError ? (
        <p className="mt-5 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </p>
      ) : (
        <AccessibilityTable rows={rows} initialFilter={initialFilter} />
      )}
    </section>
  );
}
