import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ParticipantEmailCampaign } from "./participant-email-campaign";
import { getServerTranslator } from "@/lib/i18n/server";

export async function ManagerAdminEmailPage() {
  const { t } = await getServerTranslator();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">{t("manager.email.title")}</h2>
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
    .in("ruolo", ["manager", "admin"]);

  if (error || !profile || profile.length === 0) {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">{t("manager.email.title")}</h2>
        <p className="mt-2 text-sm text-red-700">{t("common.errorForbidden")}</p>
      </section>
    );
  }

  return <ParticipantEmailCampaign />;
}
