import { ParticipantsTable } from "../../_components/participants-table";

export default function ManagerParticipantsPage() {
  return (
    <section>
      <ParticipantsTable
        apiBasePath="/api/manager/participants"
        groupSummaryLabel="Gruppi presenti"
      />
    </section>
  );
}
