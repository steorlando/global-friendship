import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

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
type AccommodationFilter = "both" | "organization" | "autonomous";

type SearchParams = {
  alloggio?: string | string[];
};

const ENROLLMENT_BUCKETS: EnrollmentBucket[] = [
  "Higher students",
  "University-Worker",
  "Operator",
];

const SELECT_FIELDS =
  "tipo_iscrizione,paese_residenza,nazione,gruppo_label,gruppo_id,data_arrivo,data_partenza,alloggio_short,alloggio";

function asSingleValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

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

function normalizeAccommodation(raw: string | null): "organization" | "autonomous" | null {
  if (!raw) return null;
  const value = raw.toLowerCase().trim();

  if (
    value.includes("provided by organization") ||
    value.includes("struttura fornita dall'organizzazione") ||
    value.includes("struttura fornita dall’organizzazione")
  ) {
    return "organization";
  }

  if (
    value.includes("atonoumous") ||
    value.includes("autonomous") ||
    value.includes("alloggio autonomamente") ||
    value.includes("arranged my own accommodation")
  ) {
    return "autonomous";
  }

  return null;
}

function normalizeFilter(value: string | null): AccommodationFilter {
  if (value === "organization") return "organization";
  if (value === "autonomous") return "autonomous";
  return "both";
}

function parseDateOnly(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function shouldIncludeByAccommodation(
  participant: ParticipantStatRow,
  filter: AccommodationFilter
): boolean {
  if (filter === "both") return true;
  const normalized = normalizeAccommodation(participant.alloggio_short ?? participant.alloggio);
  return normalized === filter;
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

export default async function ManagerStatisticsPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const selectedAccommodation = normalizeFilter(
    asSingleValue(resolvedSearchParams.alloggio)
  );

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-semibold text-red-800">Statistics</h2>
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
        <h2 className="text-xl font-semibold text-red-800">Statistics</h2>
        <p className="mt-2 text-sm text-red-700">Forbidden.</p>
      </section>
    );
  }

  const service = createSupabaseServiceClient();
  const { data, error } = await service.from("partecipanti").select(SELECT_FIELDS);

  if (error) {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-semibold text-red-800">Statistics</h2>
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

  const dailyPresence = new Map<string, number>();
  for (const participant of participants) {
    if (!shouldIncludeByAccommodation(participant, selectedAccommodation)) continue;

    const arrival = parseDateOnly(participant.data_arrivo);
    const departure = parseDateOnly(participant.data_partenza);
    if (!arrival || !departure || departure < arrival) continue;

    for (let current = arrival; current <= departure; current = addDays(current, 1)) {
      const dayKey = formatDateOnly(current);
      dailyPresence.set(dayKey, (dailyPresence.get(dayKey) ?? 0) + 1);
    }
  }

  const dailyRows = [...dailyPresence.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));

  return (
    <section className="space-y-6">
      <div className="rounded border border-neutral-200 bg-white p-4">
        <h2 className="text-xl font-semibold text-neutral-900">Statistics</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Dashboard riepilogativa dei partecipanti. Le statistiche per tipo iscrizione
          escludono &quot;Driver - Autista&quot;.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="h-max rounded border border-neutral-200 bg-white p-3 lg:sticky lg:top-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Sezioni
          </p>
          <nav className="mt-3 flex flex-col gap-2 text-sm">
            <a href="#top-counters" className="rounded border border-neutral-200 px-3 py-2 hover:bg-neutral-50">
              Contatori
            </a>
            <a href="#country-pivot" className="rounded border border-neutral-200 px-3 py-2 hover:bg-neutral-50">
              Iscritti per paese
            </a>
            <a href="#group-pivot" className="rounded border border-neutral-200 px-3 py-2 hover:bg-neutral-50">
              Iscritti per gruppo
            </a>
            <a href="#daily-presence" className="rounded border border-neutral-200 px-3 py-2 hover:bg-neutral-50">
              Presenze giornaliere
            </a>
          </nav>
        </aside>

        <div className="space-y-6">
          <section id="top-counters" className="rounded border border-neutral-200 bg-white p-4">
            <h3 className="text-lg font-semibold text-neutral-900">Contatori in alto</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Totale iscritti</p>
                <p className="mt-2 text-2xl font-semibold text-neutral-900">{totalWithoutDrivers}</p>
              </article>
              {ENROLLMENT_BUCKETS.map((bucket) => (
                <article key={bucket} className="rounded border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">{bucket}</p>
                  <p className="mt-2 text-2xl font-semibold text-neutral-900">{counters[bucket]}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="country-pivot" className="rounded border border-neutral-200 bg-white p-4">
            <h3 className="text-lg font-semibold text-neutral-900">Tabella iscritti per paese</h3>
            <div className="mt-4 overflow-auto">
              <table className="min-w-full divide-y divide-neutral-200 text-sm">
                <thead className="bg-neutral-50 text-left text-neutral-700">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Paese residenza</th>
                    {ENROLLMENT_BUCKETS.map((bucket) => (
                      <th key={bucket} className="px-3 py-2 font-semibold">
                        {bucket}
                      </th>
                    ))}
                    <th className="px-3 py-2 font-semibold">Totale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {countryLabels.length === 0 ? (
                    <tr>
                      <td colSpan={ENROLLMENT_BUCKETS.length + 2} className="px-3 py-3 text-neutral-500">
                        Nessun dato disponibile.
                      </td>
                    </tr>
                  ) : (
                    countryLabels.map((label) => {
                      const row = byCountry.get(label) ?? createEmptyBucketCounts();
                      const total = ENROLLMENT_BUCKETS.reduce((acc, bucket) => acc + row[bucket], 0);
                      return (
                        <tr key={label}>
                          <td className="px-3 py-2 text-neutral-900">{label}</td>
                          {ENROLLMENT_BUCKETS.map((bucket) => (
                            <td key={`${label}-${bucket}`} className="px-3 py-2 text-neutral-700">
                              {row[bucket]}
                            </td>
                          ))}
                          <td className="px-3 py-2 font-medium text-neutral-900">{total}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section id="group-pivot" className="rounded border border-neutral-200 bg-white p-4">
            <h3 className="text-lg font-semibold text-neutral-900">Tabella iscritti per gruppo</h3>
            <div className="mt-4 overflow-auto">
              <table className="min-w-full divide-y divide-neutral-200 text-sm">
                <thead className="bg-neutral-50 text-left text-neutral-700">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Gruppo</th>
                    {ENROLLMENT_BUCKETS.map((bucket) => (
                      <th key={bucket} className="px-3 py-2 font-semibold">
                        {bucket}
                      </th>
                    ))}
                    <th className="px-3 py-2 font-semibold">Totale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {groupLabels.length === 0 ? (
                    <tr>
                      <td colSpan={ENROLLMENT_BUCKETS.length + 2} className="px-3 py-3 text-neutral-500">
                        Nessun dato disponibile.
                      </td>
                    </tr>
                  ) : (
                    groupLabels.map((label) => {
                      const row = byGroup.get(label) ?? createEmptyBucketCounts();
                      const total = ENROLLMENT_BUCKETS.reduce((acc, bucket) => acc + row[bucket], 0);
                      return (
                        <tr key={label}>
                          <td className="px-3 py-2 text-neutral-900">{label}</td>
                          {ENROLLMENT_BUCKETS.map((bucket) => (
                            <td key={`${label}-${bucket}`} className="px-3 py-2 text-neutral-700">
                              {row[bucket]}
                            </td>
                          ))}
                          <td className="px-3 py-2 font-medium text-neutral-900">{total}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section id="daily-presence" className="rounded border border-neutral-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">Tabella presenze giornaliere</h3>
              <form method="get" className="flex items-end gap-2">
                <label className="flex flex-col gap-1 text-sm text-neutral-700">
                  Filtro alloggio
                  <select
                    name="alloggio"
                    defaultValue={selectedAccommodation}
                    className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                  >
                    <option value="both">Entrambi</option>
                    <option value="organization">Provided by organization</option>
                    <option value="autonomous">Atonoumous</option>
                  </select>
                </label>
                <button
                  type="submit"
                  className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  Applica
                </button>
              </form>
            </div>

            <div className="mt-4 overflow-auto">
              <table className="min-w-full divide-y divide-neutral-200 text-sm">
                <thead className="bg-neutral-50 text-left text-neutral-700">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Data</th>
                    <th className="px-3 py-2 font-semibold">Presenti</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {dailyRows.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-3 py-3 text-neutral-500">
                        Nessuna presenza calcolabile con il filtro selezionato.
                      </td>
                    </tr>
                  ) : (
                    dailyRows.map((row) => (
                      <tr key={row.day}>
                        <td className="px-3 py-2 text-neutral-900">{row.day}</td>
                        <td className="px-3 py-2 font-medium text-neutral-900">{row.count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
