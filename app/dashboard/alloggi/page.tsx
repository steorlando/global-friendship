import { getServerTranslator } from "@/lib/i18n/server";

export default async function AlloggiPage() {
  const { t } = await getServerTranslator();
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">{t("dashboard.accommodation.title")}</h1>
      <p className="mt-2 text-sm text-slate-500">{t("dashboard.accommodation.subtitle")}</p>
      </section>
    </main>
  );
}
