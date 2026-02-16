import { PartecipanteForm } from "./partecipante-form";

export default function PartecipantePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Profilo Partecipante</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Qui puoi vedere e aggiornare i tuoi dati.
      </p>

      <div className="mt-6">
        <PartecipanteForm />
      </div>
    </main>
  );
}
