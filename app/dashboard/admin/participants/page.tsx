import { ParticipantsTable } from "../../_components/participants-table";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function AdminParticipantsPage() {
  const { t } = await getServerTranslator();
  return (
    <section>
      <ParticipantsTable
        apiBasePath="/api/manager/participants"
        groupSummaryLabel={t("participants.table.header.group")}
      />
    </section>
  );
}
