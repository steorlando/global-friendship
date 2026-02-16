import { PartecipanteForm } from "./partecipante-form";
import { OrganizersContactCard } from "./organizers-contact-card";

export default function PartecipantePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Profilo Partecipante</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Qui puoi vedere e aggiornare i tuoi dati.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <section className="rounded border border-neutral-200 bg-white p-4">
          <PartecipanteForm />
        </section>

        <OrganizersContactCard />
      </div>
    </main>
  );
}
