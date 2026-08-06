import { DesktopRoomAssignmentWorkspace } from "../../_components/desktop-room-assignment-workspace";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function GroupLeaderRoomAssignmentPage() {
  const { t } = await getServerTranslator();

  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          {t("groupLeader.roomAssignment.title")}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {t("groupLeader.roomAssignment.subtitle")}
        </p>
      </section>

      <div className="mt-4">
        <DesktopRoomAssignmentWorkspace apiBasePath="/api/capogruppo/room-assignments" />
      </div>
    </>
  );
}
