import type { SupabaseClient } from "@supabase/supabase-js";
import { loadEmailSenderRuntimeSettings } from "@/lib/email/settings";
import { sendGmailEmail } from "@/lib/email/gmail";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type OfferRow = {
  id: string;
  participant_id: string;
  tour_id: string;
  offer_expires_at: string;
};

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://portal.globalfriendship.eu").replace(
    /\/+$/,
    ""
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

export async function processTourWaitlistAndNotify(
  service: SupabaseClient = createSupabaseServiceClient({ noStore: true })
) {
  const { data: processed, error: processError } = await service.rpc(
    "tour_process_waitlist"
  );
  if (processError) throw new Error(processError.message);

  const ids = [
    ...new Set(
      (processed ?? [])
        .map((row: { waitlist_id?: unknown }) => String(row.waitlist_id ?? ""))
        .filter(Boolean)
    ),
  ];
  if (ids.length === 0) return { offered: 0, notified: 0, failed: 0 };

  const { data: offers, error: offersError } = await service.rpc(
    "tour_claim_waitlist_notifications",
    { p_waitlist_ids: ids }
  );
  if (offersError) throw new Error(offersError.message);

  const offerRows = (offers ?? []) as OfferRow[];
  if (offerRows.length === 0) return { offered: 0, notified: 0, failed: 0 };
  const participantIds = [...new Set(offerRows.map((row) => row.participant_id))];
  const tourIds = [...new Set(offerRows.map((row) => row.tour_id))];
  const [participantsResult, toursResult, sender] = await Promise.all([
    service.from("partecipanti").select("id,nome,email").in("id", participantIds),
    service.from("tours").select("id,title").in("id", tourIds),
    loadEmailSenderRuntimeSettings(service),
  ]);
  if (participantsResult.error) throw new Error(participantsResult.error.message);
  if (toursResult.error) throw new Error(toursResult.error.message);

  const participants = new Map(
    (participantsResult.data ?? []).map((row) => [String(row.id), row])
  );
  const tours = new Map((toursResult.data ?? []).map((row) => [String(row.id), row]));
  let notified = 0;
  let failed = 0;

  for (const offer of offerRows) {
    const participant = participants.get(offer.participant_id);
    const tour = tours.get(offer.tour_id);
    const email = String(participant?.email ?? "").trim().toLowerCase();
    if (!email || !tour) {
      await service
        .from("tour_waitlist")
        .update({ offer_notification_claimed_at: null })
        .eq("id", offer.id)
        .is("offer_notification_sent_at", null);
      failed += 1;
      continue;
    }

    const name = String(participant?.nome ?? "").trim();
    const title = String(tour.title ?? "Tour");
    const safeName = escapeHtml(name);
    const safeTitle = escapeHtml(title);
    const link = `${appBaseUrl()}/dashboard/partecipante/tours`;
    try {
      await sendGmailEmail(
        {
          to: email,
          from: sender.senderEmail,
          subject: `Global Friendship - A place is available for ${title}`,
          text: [
            `Hello${name ? ` ${name}` : ""},`,
            "",
            `a place is available for ${title}. You have 30 minutes to open your participant profile and accept the change:`,
            link,
            "",
            "If you do not accept within 30 minutes, the place will be offered to the next person on the waiting list.",
            "",
            `Ciao${name ? ` ${name}` : ""},`,
            "",
            `si è liberato un posto per ${title}. Hai 30 minuti per aprire la tua scheda partecipante e accettare il cambio:`,
            link,
            "",
            "Se non accetti entro 30 minuti, il posto sarà proposto alla persona successiva in lista d'attesa.",
          ].join("\n"),
          html: `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#0f172a"><p>Hello${safeName ? ` ${safeName}` : ""},</p><p>A place is available for <strong>${safeTitle}</strong>. You have <strong>30 minutes</strong> to accept the change.</p><p><a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open my tour booking</a></p><hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0"><p>Ciao${safeName ? ` ${safeName}` : ""},</p><p>Si è liberato un posto per <strong>${safeTitle}</strong>. Hai <strong>30 minuti</strong> per accettare il cambio.</p><p>Se non accetti in tempo, il posto sarà proposto alla persona successiva.</p></div>`,
        },
        {
          gmailUser: sender.gmailUser,
          gmailAppPassword: sender.gmailAppPassword,
          senderEmail: sender.senderEmail,
        }
      );

      const { error: updateError } = await service
        .from("tour_waitlist")
        .update({
          offer_notification_sent_at: new Date().toISOString(),
          offer_notification_claimed_at: null,
        })
        .eq("id", offer.id)
        .eq("status", "offered")
        .is("offer_notification_sent_at", null);
      if (updateError) throw new Error(updateError.message);
      notified += 1;
    } catch (error) {
      console.error("Unable to send tour waitlist offer", offer.id, error);
      const { error: releaseError } = await service
        .from("tour_waitlist")
        .update({ offer_notification_claimed_at: null })
        .eq("id", offer.id)
        .is("offer_notification_sent_at", null);
      if (releaseError) {
        console.error("Unable to release tour waitlist notification claim", offer.id, releaseError);
      }
      failed += 1;
    }
  }

  return { offered: offerRows.length, notified, failed };
}

export async function processTourWaitlistAndNotifySafely(service?: SupabaseClient) {
  try {
    return await processTourWaitlistAndNotify(service);
  } catch (error) {
    console.error("Unable to process the tour waitlist after a completed operation", error);
    return { offered: 0, notified: 0, failed: 1 };
  }
}
