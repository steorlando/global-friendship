import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EventFinanceManager } from "../../_components/event-finance-manager";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function ManagerEventFinancePage() {
  const { t } = await getServerTranslator();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">{t("finance.title")}</h2>
        <p className="mt-2 text-sm text-red-700">{t("common.errorUnauthorized")}</p>
      </section>
    );
  }

  const { data: profile, error } = await supabase
    .from("profili")
    .select("ruolo")
    .eq("id", user.id)
    .maybeSingle();

  if (error || profile?.ruolo !== "manager") {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">{t("finance.title")}</h2>
        <p className="mt-2 text-sm text-red-700">{t("common.errorForbidden")}</p>
      </section>
    );
  }

  return <EventFinanceManager />;
}
