import { ParticipantsTable } from "../_components/participants-table";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function CapogruppoPage() {
  const { t } = await getServerTranslator();
  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{t("dashboard.groupLeader.title")}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {t("dashboard.groupLeader.subtitle")}
        </p>
      </section>
      <div className="mt-6">
        <ParticipantsTable
          apiBasePath="/api/capogruppo/participants"
          groupSummaryLabel={t("dashboard.groupLeader.groupSummary")}
          showRegistrationDate
          showTotalFee
          showPaymentSummary
        />
      </div>
    </>
  );
}
