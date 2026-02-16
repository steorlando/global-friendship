import { CapogruppoParticipants } from "./capogruppo-participants";

export default function CapogruppoPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Dashboard Capogruppo</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Visualizza e modifica i partecipanti dei gruppi a te associati.
      </p>

      <div className="mt-6">
        <CapogruppoParticipants />
      </div>
    </main>
  );
}
