import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerTranslator } from "@/lib/i18n/server";
import { ParticipantTourBooking } from "./participant-tour-booking";

export default async function ParticipantToursPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?role=partecipante&next=%2Fdashboard%2Fpartecipante%2Ftours");
  }
  const { t } = await getServerTranslator();
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">{t("tours.participant.title")}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{t("tours.participant.subtitle")}</p>
      <div className="mt-7"><ParticipantTourBooking /></div>
    </main>
  );
}
