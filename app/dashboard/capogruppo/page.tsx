import { ParticipantsTable } from "../_components/participants-table";

export default function CapogruppoPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard Capogruppo</h1>
      <p className="mt-2 text-sm text-slate-500">
        Visualizza e modifica i partecipanti dei gruppi a te associati.
      </p>

      <div className="mt-6">
        <ParticipantsTable
          apiBasePath="/api/capogruppo/participants"
          groupSummaryLabel="Gruppi associati"
        />
      </div>
    </main>
  );
}
