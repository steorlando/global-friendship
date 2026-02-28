import { PartecipanteForm } from "./partecipante-form";
import { OrganizersContactCard } from "./organizers-contact-card";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function PartecipantePage() {
  const { t } = await getServerTranslator();
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900">{t("dashboard.participant.title")}</h1>
      <p className="mt-2 text-sm text-slate-500">{t("dashboard.participant.subtitle")}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <PartecipanteForm />
        </section>

        <OrganizersContactCard />
      </div>
    </main>
  );
}
