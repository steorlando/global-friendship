import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ParticipantEmailCampaign } from "./participant-email-campaign";

export async function ManagerAdminEmailPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">Email Campaigns</h2>
        <p className="mt-2 text-sm text-red-700">Unauthorized.</p>
      </section>
    );
  }

  const { data: profile, error } = await supabase
    .from("profili")
    .select("ruolo")
    .eq("id", user.id)
    .maybeSingle();

  if (error || (profile?.ruolo !== "manager" && profile?.ruolo !== "admin")) {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">Email Campaigns</h2>
        <p className="mt-2 text-sm text-red-700">Forbidden.</p>
      </section>
    );
  }

  return <ParticipantEmailCampaign />;
}
