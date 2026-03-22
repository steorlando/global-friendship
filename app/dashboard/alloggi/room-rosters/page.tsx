import { AccommodationRoomRosterManager } from "../../_components/accommodation-room-roster-manager";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function AccommodationRoomRostersPage() {
  const { t } = await getServerTranslator();

  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          {t("accommodation.roomRoster.title")}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {t("accommodation.roomRoster.subtitle")}
        </p>
      </section>

      <div className="mt-6">
        <AccommodationRoomRosterManager />
      </div>
    </>
  );
}
