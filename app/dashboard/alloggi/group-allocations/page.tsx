import { AccommodationGroupAllocationsManager } from "../../_components/accommodation-group-allocations-manager";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function AccommodationGroupAllocationsPage() {
  const { t } = await getServerTranslator();

  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          {t("accommodation.groupAllocations.title")}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {t("accommodation.groupAllocations.subtitle")}
        </p>
      </section>

      <div className="mt-6">
        <AccommodationGroupAllocationsManager />
      </div>
    </>
  );
}
