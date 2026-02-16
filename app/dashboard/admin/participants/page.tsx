import { ParticipantsTable } from "../../_components/participants-table";

export default function AdminParticipantsPage() {
  return (
    <section>
      <ParticipantsTable
        apiBasePath="/api/manager/participants"
        groupSummaryLabel="Gruppi presenti"
      />
    </section>
  );
}
