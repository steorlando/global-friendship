import { loadArrivalDashboardData } from "@/lib/accoglienza/arrival-data";
import { requireReceptionContext } from "@/lib/accoglienza/auth";
import { ArrivalDashboard } from "./arrival-dashboard";

export const dynamic = "force-dynamic";

export default async function AccoglienzaPage() {
  const auth = await requireReceptionContext();
  if ("errorResponse" in auth) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
          Accesso non autorizzato.
        </section>
      </main>
    );
  }

  let participants;
  let groupLeaders;
  let loadError: string | null = null;
  try {
    const data = await loadArrivalDashboardData(auth.service);
    participants = data.participants;
    groupLeaders = data.groupLeaders;
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Impossibile caricare gli arrivi.";
  }

  if (loadError || !participants || !groupLeaders) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
          {loadError ?? "Impossibile caricare gli arrivi."}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1800px] px-3 py-4 sm:px-6 sm:py-8">
      <ArrivalDashboard
        initialParticipants={participants}
        groupLeaders={groupLeaders}
      />
    </main>
  );
}
