import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { DailyPresenceSection } from "./daily-presence-section";

export const dynamic = "force-dynamic";

type ParticipantStatRow = {
  tipo_iscrizione: string | null;
  paese_residenza: string | null;
  nazione: string | null;
  gruppo_label: string | null;
  gruppo_id: string | null;
  data_arrivo: string | null;
  data_partenza: string | null;
  alloggio_short: string | null;
  alloggio: string | null;
};

type EnrollmentBucket = "Higher students" | "University-Worker" | "Operator";

const ENROLLMENT_BUCKETS: EnrollmentBucket[] = [
  "Higher students",
  "University-Worker",
  "Operator",
];

const SELECT_FIELDS =
  "tipo_iscrizione,paese_residenza,nazione,gruppo_label,gruppo_id,data_arrivo,data_partenza,alloggio_short,alloggio";

function mapEnrollmentBucket(rawType: string | null): EnrollmentBucket | null {
  if (!rawType) return null;
  const value = rawType.toLowerCase().trim();

  if (value.includes("driver - autista")) return null;
  if (value.includes("higher student")) return "Higher students";
  if (value.includes("undergraduate")) return "University-Worker";
  if (value.includes("worker - lavoratore")) return "University-Worker";
  if (value.includes("operator - operatore")) return "Operator";

  return null;
}

function createEmptyBucketCounts(): Record<EnrollmentBucket, number> {
  return {
    "Higher students": 0,
    "University-Worker": 0,
    Operator: 0,
  };
}

function sortedLabels(values: Set<string>): string[] {
  return [...values].sort((a, b) => {
    if (a === "-") return 1;
    if (b === "-") return -1;
    return a.localeCompare(b);
  });
}

export default async function ManagerStatisticsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">Statistics</h2>
        <p className="mt-2 text-sm text-red-700">Unauthorized.</p>
      </section>
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profili")
    .select("ruolo")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || (profile?.ruolo !== "manager" && profile?.ruolo !== "admin")) {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">Statistics</h2>
        <p className="mt-2 text-sm text-red-700">Forbidden.</p>
      </section>
    );
  }

  const service = createSupabaseServiceClient();
  const { data, error } = await service.from("partecipanti").select(SELECT_FIELDS);

  if (error) {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">Statistics</h2>
        <p className="mt-2 text-sm text-red-700">{error.message}</p>
      </section>
    );
  }

  const participants = (data ?? []) as ParticipantStatRow[];

  const counters = createEmptyBucketCounts();
  const byCountry = new Map<string, Record<EnrollmentBucket, number>>();
  const byGroup = new Map<string, Record<EnrollmentBucket, number>>();

  for (const participant of participants) {
    const bucket = mapEnrollmentBucket(participant.tipo_iscrizione);
    if (!bucket) continue;

    counters[bucket] += 1;

    const country = (participant.paese_residenza ?? participant.nazione ?? "").trim() || "-";
    const currentCountry = byCountry.get(country) ?? createEmptyBucketCounts();
    currentCountry[bucket] += 1;
    byCountry.set(country, currentCountry);

    const group = (participant.gruppo_label ?? participant.gruppo_id ?? "").trim() || "-";
    const currentGroup = byGroup.get(group) ?? createEmptyBucketCounts();
    currentGroup[bucket] += 1;
    byGroup.set(group, currentGroup);
  }

  const countryLabels = sortedLabels(new Set(byCountry.keys()));
  const groupLabels = sortedLabels(new Set(byGroup.keys()));
  const totalWithoutDrivers = ENROLLMENT_BUCKETS.reduce(
    (acc, bucket) => acc + counters[bucket],
    0
  );

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Statistics</h2>
        <p className="mt-2 text-sm text-slate-500">
          Participant overview dashboard. Enrollment-type statistics exclude
          &quot;Driver - Autista&quot;.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="h-max rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sections
          </p>
          <nav className="mt-3 flex flex-col gap-2 text-sm">
            <a href="#top-counters" className="rounded border border-slate-200 px-4 py-3 hover:bg-slate-50">
              Counters
            </a>
            <a href="#country-pivot" className="rounded border border-slate-200 px-4 py-3 hover:bg-slate-50">
              Registrations by country
            </a>
            <a href="#group-pivot" className="rounded border border-slate-200 px-4 py-3 hover:bg-slate-50">
              Registrations by group
            </a>
            <a href="#daily-presence" className="rounded border border-slate-200 px-4 py-3 hover:bg-slate-50">
              Daily presence
            </a>
          </nav>
        </aside>

        <div className="space-y-6">
          <section id="top-counters" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Top counters</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Total registrations
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{totalWithoutDrivers}</p>
              </article>
              {ENROLLMENT_BUCKETS.map((bucket) => (
                <article key={bucket} className="rounded border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{bucket}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{counters[bucket]}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="country-pivot" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              Registrations by country
            </h3>
            <div className="mt-4 overflow-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50/50 text-left text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Country</th>
                    {ENROLLMENT_BUCKETS.map((bucket) => (
                      <th key={bucket} className="px-4 py-3 font-semibold">
                        {bucket}
                      </th>
                    ))}
                    <th className="px-4 py-3 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {countryLabels.length === 0 ? (
                    <tr>
                      <td colSpan={ENROLLMENT_BUCKETS.length + 2} className="px-3 py-3 text-slate-500">
                        No data available.
                      </td>
                    </tr>
                  ) : (
                    countryLabels.map((label) => {
                      const row = byCountry.get(label) ?? createEmptyBucketCounts();
                      const total = ENROLLMENT_BUCKETS.reduce((acc, bucket) => acc + row[bucket], 0);
                      return (
                        <tr key={label}>
                          <td className="px-4 py-3 text-slate-900">{label}</td>
                          {ENROLLMENT_BUCKETS.map((bucket) => (
                            <td key={`${label}-${bucket}`} className="px-4 py-3 text-slate-700">
                              {row[bucket]}
                            </td>
                          ))}
                          <td className="px-4 py-3 font-medium text-slate-900">{total}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section id="group-pivot" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              Registrations by group
            </h3>
            <div className="mt-4 overflow-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50/50 text-left text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Group</th>
                    {ENROLLMENT_BUCKETS.map((bucket) => (
                      <th key={bucket} className="px-4 py-3 font-semibold">
                        {bucket}
                      </th>
                    ))}
                    <th className="px-4 py-3 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupLabels.length === 0 ? (
                    <tr>
                      <td colSpan={ENROLLMENT_BUCKETS.length + 2} className="px-3 py-3 text-slate-500">
                        No data available.
                      </td>
                    </tr>
                  ) : (
                    groupLabels.map((label) => {
                      const row = byGroup.get(label) ?? createEmptyBucketCounts();
                      const total = ENROLLMENT_BUCKETS.reduce((acc, bucket) => acc + row[bucket], 0);
                      return (
                        <tr key={label}>
                          <td className="px-4 py-3 text-slate-900">{label}</td>
                          {ENROLLMENT_BUCKETS.map((bucket) => (
                            <td key={`${label}-${bucket}`} className="px-4 py-3 text-slate-700">
                              {row[bucket]}
                            </td>
                          ))}
                          <td className="px-4 py-3 font-medium text-slate-900">{total}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <DailyPresenceSection participants={participants} />
        </div>
      </div>
    </section>
  );
}
