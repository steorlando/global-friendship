import Link from "next/link";
import { getServerTranslator } from "@/lib/i18n/server";
import {
  loadStaffAvailabilityRows,
  requireStaffAvailabilityManagerOrAdmin,
} from "@/lib/statistics/staff-availability-server";
import type { StaffAvailabilityExportRow } from "@/lib/statistics/staff-availability-export";
import { StaffAvailabilityTable } from "./staff-availability-table";

export const dynamic = "force-dynamic";

export default async function StaffAvailabilityListPage() {
  const { t } = await getServerTranslator();
  const auth = await requireStaffAvailabilityManagerOrAdmin();

  if ("errorResponse" in auth) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">{t("staffAvailabilityList.title")}</h2>
        <p className="mt-2 text-sm text-red-700">{t("common.errorForbidden")}</p>
      </section>
    );
  }

  let rows: StaffAvailabilityExportRow[] = [];
  let loadError: string | null = null;
  try {
    rows = await loadStaffAvailabilityRows(auth.service);
  } catch (error) {
    loadError = error instanceof Error ? error.message : t("staffAvailabilityList.loadError");
  }

  if (loadError) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">{t("staffAvailabilityList.title")}</h2>
        <p className="mt-2 text-sm text-red-700">{loadError}</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-violet-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t("staffAvailabilityList.title")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("staffAvailabilityList.subtitle")}</p>
        </div>
        <Link
          href="/dashboard/manager#staff-availability"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <span aria-hidden="true">←</span>
          {t("staffAvailabilityList.back")}
        </Link>
      </div>
      <StaffAvailabilityTable rows={rows} />
    </section>
  );
}
