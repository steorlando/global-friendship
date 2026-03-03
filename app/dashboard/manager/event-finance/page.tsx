import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
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

  const email = (user.email ?? "").trim().toLowerCase();
  const service = createSupabaseServiceClient();
  const { data: profile, error } = await service
    .from("profili")
    .select("ruolo")
    .ilike("email", email)
    .eq("ruolo", "manager")
    .limit(1);

  if (error || !profile || profile.length === 0) {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">{t("finance.title")}</h2>
        <p className="mt-2 text-sm text-red-700">{t("common.errorForbidden")}</p>
      </section>
    );
  }

  return <EventFinanceManager />;
}
