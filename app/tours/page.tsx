import { PublicTours } from "./public-tours";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function ToursPage() {
  const { t } = await getServerTranslator();
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-6">
      <header className="mb-8 max-w-3xl">
        <span className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
          Global Friendship
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {t("tours.public.title")}
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">{t("tours.public.subtitle")}</p>
      </header>
      <PublicTours />
    </main>
  );
}
